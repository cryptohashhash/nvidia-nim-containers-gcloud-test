use std::env;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Clone)]
pub struct NimClient {
    base_url: String,
    api_key: String,
    client: Client,
}

#[derive(Serialize)]
struct RecognitionPayload {
    audio_data: String, // Base64 encoded
    language_code: String,
}

impl NimClient {
    pub fn new() -> Self {
        let api_key = env::var("NVIDIA_API_KEY").expect("NVIDIA_API_KEY must be set");
        // Default to Parakeet ASR endpoint
        let base_url = env::var("NIM_BASE_URL").unwrap_or_else(|_| "https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions".to_string());
        
        Self {
            base_url,
            api_key,
            client: Client::new(),
        }
    }

    pub async fn transcribe_audio(&self, audio_data: Vec<u8>, language_code: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // Map simple codes (en, zh, ru) to NVIDIA Model Codes (en-US, zh-CN, ru-RU)
        // Canary 1B supports: en-US, es-US, de-DE, es-ES, fr-FR, zh-CN, ru-RU, etc.
        let model_lang_code = match language_code {
            "zh" => "zh-CN",
            "ru" => "ru-RU",
            _ => "en-US",
        };

        // Default to Hosted API, but allow override from env (e.g., http://nim-asr:9000/v1/audio/transcriptions)
        let base_url = env::var("NIM_ASR_URL").unwrap_or_else(|_| "https://ai.api.nvidia.com/v1/genai/nvidia/riva-asr-canary-1b".to_string());
        
        // If it's the hosted API (contains "ai.api.nvidia.com"), usage JSON payload
        if base_url.contains("ai.api.nvidia.com") {
             // Hosted API (JSON)
             let invoke_url = if base_url.starts_with("http") { base_url } else { format!("https://ai.api.nvidia.com/v1/genai/nvidia/{}", base_url) };
             
             use base64::{Engine as _, engine::general_purpose::STANDARD};
             let b64_audio = STANDARD.encode(&audio_data);
             let payload = json!({
                 "audio_data": b64_audio,
                 "language_code": model_lang_code, 
             });

             let res = self.client.post(&invoke_url)
                 .header("Authorization", format!("Bearer {}", self.api_key))
                 .header("Content-Type", "application/json")
                 .json(&payload)
                 .send()
                 .await
                 .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

             if !res.status().is_success() {
                  let error_text = res.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                  return Err(format!("NIM ASR API Error (Hosted): {}", error_text).into());
             }

             let body: serde_json::Value = res.json().await.map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
             if let Some(text) = body.get("text").and_then(|v| v.as_str()) {
                  Ok(text.to_string())
             } else if let Some(transcriptions) = body.get("transcriptions") {
                  Ok(transcriptions[0]["text"].as_str().unwrap_or("").to_string())
             } else {
                  Ok("".to_string())
             }

        } else {
            // Local NIM (Multipart) - Standard /v1/audio/transcriptions
            // Ensure URL is full path
            let invoke_url = if base_url.starts_with("http") { base_url } else { format!("http://nim-asr:9000/v1/audio/transcriptions") };
            
            println!("Configuration: NIM_ASR_URL env: '{}'", env::var("NIM_ASR_URL").unwrap_or_default());
            println!("DEBUG: Sending Multipart ASR request to URL: '{}' [Lang: {}]", invoke_url, model_lang_code);

            let part = reqwest::multipart::Part::bytes(audio_data)
                .file_name("audio.wav")
                .mime_str("audio/wav")?;

            let form = reqwest::multipart::Form::new()
                .part("file", part)
                .text("model", "canary-1b")
                .text("language", model_lang_code.to_string())
                .text("response_format", "json");

            let res = self.client.post(&invoke_url)
                // .header("Authorization", format!("Bearer {}", self.api_key)) // Local might not need key, but safer to keep if verified
                .multipart(form)
                .send()
                .await
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

             if !res.status().is_success() {
                  let error_text = res.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                  return Err(format!("NIM ASR API Error (Local): {}", error_text).into());
             }

             let body: serde_json::Value = res.json().await.map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
             // OpenAI response format: { "text": "..." }
             if let Some(text) = body.get("text").and_then(|v| v.as_str()) {
                  Ok(text.to_string())
             } else {
                  Ok("".to_string())
             }
        }
    }

    pub async fn synthesize_speech(&self, text: &str) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
        // Default to local container URL pattern for Magpie/FastPitch if not hosted
        let base_url = env::var("NIM_TTS_URL").unwrap_or_else(|_| "http://localhost:9000/v1/tts/synthesize".to_string());
        
        let payload = json!({
            "text": text,
            "speaker": "English-US.Female-1", 
        });

        let res = self.client.post(&base_url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

        if !res.status().is_success() {
             let error_text = res.text().await.unwrap_or_else(|_| "Unknown error".to_string());
             return Err(format!("NIM TTS API Error: {}. (If running locally, ensure 'nim-tts' container is running at {})", error_text, base_url).into());
        }

        let body: serde_json::Value = res.json().await.map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
        
        if let Some(audio_content) = body.get("audio_content").and_then(|v| v.as_str()) {
             use base64::{Engine as _, engine::general_purpose::STANDARD};
             let audio_data = STANDARD.decode(audio_content).map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
             Ok(audio_data)
        } else {
             Err("Could not find audio_content in response".into())
        }
    }
}

