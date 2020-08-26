# 🛠️ API

This repository contains the API server, primarily for communicating with Firebase. It's a single Node.js file, [`index.mjs`](./index.mjs) that runs a [Polka](https://github.com/lukeed/polka) server which sends data to Firebase.

![Node CI](https://github.com/koj-co/tracker/workflows/Node%20CI/badge.svg)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Uptime Robot status](https://img.shields.io/uptimerobot/status/m785581918-8d232ece32afefcaf778abfe)](https://koj.co)
[![Uptime Robot ratio (7 days)](https://img.shields.io/uptimerobot/ratio/7/m785581918-8d232ece32afefcaf778abfe)](https://status.koj.co)

## ⚙️ Configuration

The following environment variables are required.

Firebase:

- `FIREBASE_DATABASE_URL` is the full Firebase database URL
- `FIREBASE_SERVICE_ACCOUNT` is the service account key in JSON

Authentication:

- `TWT_SECRET` is the secret used to sign [TWTs](https://github.com/koj-co/twt)
- `JWT_SECRET` is the secret used to sign JWTs
- `ROOT_USERNAME` is the username for logging in
- `ROOT_PASSWORD` is the hashed password for logging in

AWS-managed ElasticSearch:

- `AWS_ELASTIC_HOST` is the endpoint
- `AWS_ACCESS_KEY_ID` is the AWS access key
- `AWS_SECRET_ACCESS_KEY` is the AWS secret key
- `AWS_REGION` is the AWS region

Sales:

- `PIPEDRIVE_API_KEY` is the Pipedrive CRM API key
- `SLACK_BOT_ACCESS_TOKEN` is the access token of the Slack bot

Locally, these environment variables are loaded from a `.env`. This repository also uses GitHub Actions CI/CD and triggers an endpoint for deployment from the `master` branch. Optionally, you may add the required environment variables as repository secrets (see [Creating and storing encrypted secrets](https://docs.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets)).

## 📄 License

- Code: [MIT](./LICENSE) © [Koj](https://koj.co)
- "Firebase" is a trademark of Google LLC

<p align="center">
  <a href="https://koj.co">
    <img width="44" alt="Koj" src="https://kojcdn.com/v1598284251/website-v2/koj-github-footer_m089ze.svg">
  </a>
</p>
<p align="center">
  <sub>An open source project by <a href="https://koj.co">Koj</a>. <br> <a href="https://koj.co">Furnish your home in style, for as low as CHF175/month →</a></sub>
</p>
