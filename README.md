<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1gWIqWh43W_W10U2wWV3nFFqDni7-x9yV

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Text-to-Speech (Piper voice models)

Sasha's voice is synthesized by a local [Piper](https://github.com/rhasspy/piper) TTS
container (`server/piper/docker-compose.yml`). The voice models (`.onnx` files) are
**not** committed — they exceed GitHub's file size limit and are fetched at runtime.

- Start the service: `docker compose -f server/piper/docker-compose.yml up -d`
- On first synthesis the container auto-downloads the `en_US-lessac-high` voice from
  HuggingFace and caches it under `server/piper/data/` (gitignored).
- To pre-populate the cache manually, download the voice into `server/piper/data/` from
  the [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/lessac)
  repo.
