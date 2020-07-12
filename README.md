# 🛠️ API

This repository contains the API server, primarily for communicating with Firebase. It's a single Node.js file, [`index.mjs`](./index.mjs) that runs a [Polka](https://github.com/lukeed/polka) server which sends data to Firebase.

![Node CI](https://github.com/koj-co/tracker/workflows/Node%20CI/badge.svg)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## ⚙️ Configuration

The following environment variables are required:

- `FIREBASE_DATABASE_URL` is the full Firebase database URL
- `FIREBASE_SERVICE_ACCOUNT` is the service account key in JSON

Locally, these environment variables are loaded from a `.env`. This repository also uses GitHub Actions CI/CD and triggers an endpoint for deployment from the `master` branch. Optionally, you may add the required environment variables as repository secrets (see [Creating and storing encrypted secrets](https://docs.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets)).

## 📄 License

- Code: [MIT](./LICENSE) © [Koj](https://joinkoj.com)
- "Firebase" is a trademark of Google LLC
