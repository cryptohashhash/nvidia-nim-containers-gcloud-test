use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use tracing::{debug, info, error};

use crate::nim_client::NimClient;

pub async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

use serde::Deserialize;

#[derive(Deserialize)]
struct ConfigMessage {
    #[serde(rename = "type")]
    msg_type: String, // "config"
    source: Option<String>,
    target: Option<String>,
}

async fn handle_socket(mut socket: WebSocket) {
    info!("Client connected");
    let nim_client = NimClient::new();
    
    // Default State
    let mut source_lang = "en".to_string();
    let mut target_lang = "en".to_string();

    while let Some(msg) = socket.recv().await {
        let msg = match msg {
            Ok(msg) => msg,
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
        };

        if let Message::Binary(data) = msg {
            debug!("Received audio data of size: {} bytes [Source: {}]", data.len(), source_lang);
            
            // Send to NIM ASR (Parakeet) with dynamic language
            match nim_client.transcribe_audio(data, &source_lang).await {
                Ok(transcript) => {
                    info!("NIM Transcript [{}]: {}", source_lang, transcript);
                     if let Err(e) = socket.send(Message::Text(format!("Transcript: {}", transcript))).await {
                        error!("Failed to send transcript: {}", e);
                        break;
                    }
                    
                    // Zero-Shot Voice Cloning / TTS (FastPitch)
                    // TODO: Handle Translation Logic manually if needed (ASR -> LLM -> TTS)
                    // For now, simple echo or basic TTS of the transcript
                    match nim_client.synthesize_speech(&transcript).await {
                        Ok(audio) => {
                             info!("Generated TTS Audio: {} bytes", audio.len());
                             if let Err(e) = socket.send(Message::Binary(audio)).await {
                                 error!("Failed to send audio: {}", e);
                                 break;
                             }
                        },
                        Err(e) => {
                             error!("NIM TTS Error: {}", e);
                             // Non-fatal, just log and inform client
                             let _ = socket.send(Message::Text(format!("TTS Error: {}", e))).await;
                        }
                    }
                },
                Err(e) => {
                    error!("NIM ASR Error: {}", e);
                    if let Err(e) = socket.send(Message::Text(format!("Error: {}", e))).await {
                        error!("Failed to send error: {}", e);
                        break;
                    }
                }
            }
            
        } else if let Message::Text(text) = msg {
             debug!("Received text: {}", text);
             
             // Try parsing as Config Message
             if let Ok(config) = serde_json::from_str::<ConfigMessage>(&text) {
                 if config.msg_type == "config" {
                     if let Some(src) = config.source {
                         info!("Updating Source Language to: {}", src);
                         source_lang = src;
                     }
                     if let Some(tgt) = config.target {
                         info!("Updating Target Language to: {}", tgt);
                         target_lang = tgt;
                     }
                     continue; // Skip processing as prompt
                 }
             }

             if text.starts_with("/speak ") {
                 let prompt = text.trim_start_matches("/speak ");
                 info!("Synthesizing text: {}", prompt);
                 match nim_client.synthesize_speech(prompt).await {
                    Ok(audio) => {
                         info!("Generated TTS Audio: {} bytes", audio.len());
                         if let Err(e) = socket.send(Message::Binary(audio)).await {
                             error!("Failed to send audio: {}", e);
                             break;
                         }
                    },
                    Err(e) => {
                         error!("NIM TTS Error: {}", e);
                         let _ = socket.send(Message::Text(format!("TTS Error: {}", e))).await;
                    }
                 }
             } else {
                 if let Err(e) = socket.send(Message::Text(format!("Echo: {}", text))).await {
                     error!("Failed to send message: {}", e);
                     break;
                 }
             }
        }
    }

    info!("Client disconnected");
}

