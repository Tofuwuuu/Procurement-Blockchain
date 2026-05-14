# Project Structure

This repository is organized around three main areas:

- `backend/` - FastAPI application, MongoDB models, authentication, scraping utilities, and API routes.
- `backend/blockchain/` - blockchain node code, Hyperledger Fabric network scripts/config, and chaincode.
- `frontend/` - React/TypeScript client application.

Supporting files:

- `docs/` - project notes, analysis, and architecture documentation.
- `README.md` - top-level setup and usage guide.
- `.gitignore` - keeps generated dependencies, caches, builds, Fabric runtime output, and local scratch files out of Git.

Generated locally and not meant to be committed:

- `.venv/`, `backend/venv/`
- `frontend/node_modules/`
- `frontend/build/`
- `**/__pycache__/`
- `backend/blockchain/network/artifacts/`
- `backend/blockchain/network/crypto-config/`
- `backend/blockchain/network/crypto-config.backup-*/`
