# Product Requirements Document (PRD) & Developer Guide
## Project: NVIDIA NIM Speech Lab (Multilingual S2S)

### 1. Executive Summary
**Objective**: Build a real-time, ultra-low-latency **Speech-to-Speech (S2S)** translation platform capable of converting spoken audio (e.g., Mandarin) into translated text/audio (e.g., Russian) using local GPU acceleration.

**Target Audience**: Developers, Linguists, and Cost-Conscious AI Engineers.
**Core Value**: leveraging "Ready-Made" NVIDIA NIM containers on commodity cloud hardware (GCP L4) to achieve **60-80% cost savings** compared to managed API endpoints, without sacrificing performance.

---

### 2. Architecture Overview
The system is a "hybrid" AI application where the logic lives in a lightweight Middleware (Rust), but the heavy lifting is offloaded to specialized AI Containers (Nvidia NIMs) running on the same GPU.

```mermaid
graph TD
    User[User / Browser] -->|WebSocket (Audio Stream)| App[Rust Backend (Axum)]
    App -->|Multipart/Audio| ASR[NVIDIA NIM: Canary-1B]
    App -->|Text| TTS[NVIDIA NIM: FastPitch/Magpie]
    ASR -->|Transcript (En/Ru/Zh)| App
    TTS -->|Synthesized Audio| App
    App -->|Transcript + Audio results| User
    
    subgraph "Google Cloud L4 Instance"
        App
        ASR
        TTS
    end
```

### 3. Key Components & Technology Decisions

#### A. NVIDIA NIM Containers ("The Brains")
*   **What are they?**: Pre-packaged, highly optimized Docker containers provided by NVIDIA. They contain the model weights (e.g., Canary 1B) and an inference server (Triton) tuned for NVIDIA GPUs.
*   **Why use them?**:
    1.  **Zero Setup**: No need to install PyTorch, CUDA, or hunt for weights. `docker run` and it works.
    2.  **Performance**: 2-5x faster than running raw HuggingFace models due to TensorRT optimizations.
*   **API Key Strategy**:
    *   **Downloading**: Requires an NVIDIA NGC Key (free).
    *   **Running (Local)**: No API key required. This is critical for privacy and avoiding "per-token" costs.

#### B. Google Cloud L4 GPUs ("The Hardware")
*   **Why L4?**: The NVIDIA L4 (24GB VRAM) is the "Sweet Spot" for inference.
*   **Cost Analysis**:
    *   **Our Setup (Self-Hosted on GCE)**: ~$0.56 / hour (fixed cost).
    *   **Vertex AI / Managed Endpoints**: Often ~$1.50 - $2.40 / hour for always-on endpoints.
    *   **Result**: We save ~70% by managing the container ourselves with Docker Compose.

#### C. Backend (Rust) vs Frontend (React)
*   **Rust (Backend)**: Chosen for memory safety and concurrency. It acts as a high-speed "Traffic Cop", routing audio packets between the User, ASR, and TTS containers without adding latency.
*   **React (Frontend)**: Provides a "Premium" dark-mode UI with real-time audio visualization and low-latency WebSocket communication.

---

### 4. Deliverables & Features

#### ✅ Deliverable 1: Multilingual ASR
*   **Capability**: Transcribe speech in real-time.
*   **Languages**: English (US), Mandarin (ZH), Russian (RU).
*   **Tech**: Uses `riva-asr-canary-1b` model via `multipart/form-data` API.

#### ✅ Deliverable 2: Zero-Shot TTS
*   **Capability**: Convert text back to audio.
*   **Status**: Currently English-focused (FastPitch).
*   **Tech**: Uses `fastpitch-hifigan-tts` model.

#### ✅ Deliverable 3: Infrastructure as Code
*   **Deployment**: One-click `deploy_gcp.sh` script.
*   **Orchestration**: `docker-compose.yml` manages the lifecycle of the App + 2 AI Containers.
*   **Stability**: Includes Swap File configuration (16GB) to prevent OOM crashes during model compilation.

---

### 5. "Ready-Made" Containers: A Clarification for Juniors
**Junior Dev Question**: *"Why don't we just click 'Deploy' on Google Cloud Console?"*

**Answer**:
Google Cloud's "Click to Deploy" (Vertex AI Model Garden) actually **uses these exact same NVIDIA NIM containers** under the hood!
*   **The Difference**:
    *   **Google Managed**: They spin it up, manage the health, and charge you a premium (Markup).
    *   **Our Way**: We pull the *same* Docker image from NVIDIA (`nvcr.io/...`), run it on a raw VM, and pocket the difference.
*   **Lesson**: Cloud Providers often sell "Convenience" at a 2-3x markup. As an engineer, knowing how to run `docker compose` makes you significantly more valuable to the business.

---

### 6. Quick Start Guide
1.  **Clone Repo**: `git clone https://github.com/cryptohashhash/nvidia-nim-containers-gcloud-test`
2.  **Set Secrets**: Create `.env` with `NVIDIA_API_KEY`.
3.  **Run**: `docker compose up --build`.
4.  **Access**: `http://localhost:3000`.

### 7. Future Roadmap
1.  **Multilingual TTS**: Replace `FastPitch` with `Parakeet-CTC` or a multilingual TTS NIM to support Russian/Chinese voice output.
2.  **LLM Translation Layer**: Insert a Llama-3-8b-Instruct NIM between ASR and TTS to fix grammar and improve translation accuracy.
