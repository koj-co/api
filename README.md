# 📈 Tracker

This repository contains the tracking server for analytics for our products. It's a single Node.js file, [`index.mjs`](./index.mjs) that runs a [Polka](https://github.com/lukeed/polka) server which sends data to AWS-managed ElasticSearch. Apart from provided key-value pairs, it tracks the user's geolocation (from their IP address) and device information (from their user-agent).

![Node CI](https://github.com/koj-co/tracker/workflows/Node%20CI/badge.svg)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## ⭐ Getting started

1. Clone this repository
2. Add the required environment variables
3. Run the Node.js script with `node index.mjs`

## 💡 Features

All you need to do is send a record, as straightforward as a `pagevew` with its `page_url`:

```json
{
  "event": "pageview",
  "page_url": "http://localhost:3000/en-ch/about"
}
```

This is converted to a record including several additional details, like the geolocation, browser, and URL info. From 2 keys that you send, a record with around 30 keys is saved.

### Basic details

Information about the date and IP address is first added. If you're using a proxy like Cloudflare, the `X-Forwarded-For` header is respected:

```json
{
  "event": "pageview",
  "anonymous_ip": "66.6.44.0",
  "date": "2020-07-08T09:57:25.913Z"
}
```

### Geolocation

Details are added from the IP address of the user/request, including the code and English name of the country, continent, region, and city:

```json
{
  "location_city_geoname_id": 5128581,
  "location_city_names_en": "New York",
  "location_continent_code": "NA",
  "location_continent_geoname_id": 6255149,
  "location_continent_names_en": "North America",
  "location_country_geoname_id": 6252001,
  "location_country_iso_code": "US",
  "location_country_names_en": "United States",
  "location_location_accuracy_radius": 1000,
  "location_location_latitude": 40.738,
  "location_location_longitude": -73.986,
  "location_location_metro_code": 501,
  "location_location_time_zone": "America/New_York",
  "location_postal_code": "10010",
  "location_registered_country_geoname_id": "6252001",
  "location_registered_country_iso_code": "US",
  "location_registered_country_names_en": "United States",
  "location_subdivisions_0_geoname_id": 5128638,
  "location_subdivisions_0_iso_code": "NY",
  "location_subdivisions_0_names_en": "New York"
}
```

### Device

The `User-Agent` header is parsed to find information such as browser, operating system, and device:

```json
{
  "user_agent_browser_major": "13",
  "user_agent_browser_name": "Safari",
  "user_agent_browser_version": "13.1.1",
  "user_agent_engine_name": "WebKit",
  "user_agent_engine_version": "605.1.15",
  "user_agent_os_name": "Mac OS",
  "user_agent_os_version": "10.15.5",
  "user_agent_string": "Mozilla/5.0 (Macintosh; ..."
}
```

### URL

Any URLs (with keys ending with `_url`) are also parsed. You even get details about the path with and without the language parameter:

```json
{
  "page_url_host": "localhost:3000",
  "page_url_hostname": "localhost",
  "page_url_href": "http://localhost:3000/en-ch/about",
  "page_url_origin": "http://localhost:3000",
  "page_url_pathname": "/en-ch/about",
  "page_url_pathname_lang": "en-ch",
  "page_url_pathname_no_lang": "/about",
  "page_url_port": 3000,
  "page_url_protocol": "http:",
  "page_url_slashes": true"
}
```

## ⚙️ Configuration

The following environment variables are required:

- `AWS_ELASTIC_HOST` is the host endpoint without protocol, e.g., search-example.eu-central-1.es.amazonaws.com
- `AWS_ACCESS_KEY_ID` is the AWS access key
- `AWS_SECRET_ACCESS_KEY` is the AWS secret key
- `AWS_REGION` is the AWS region, e.g., "eu-central-1"

Locally, these environment variables are loaded from a `.env`. Your AWS IAM should have the permission `AmazonESFullAccess` (see [Creating Your First IAM Admin User and Group](https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_create-admin-group.html)).

This repository also uses CI/CD and triggers an endpoint for deployment from the `master` branch. Optionally, you may add the following as repository secrets (see [Creating and storing encrypted secrets](https://docs.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets)):

- `CI_WEBHOOK`

## ⚡ Benchmark

Using [`wrk`](https://github.com/wg/wrk) on Node.js v14.0.0 and the command `wrk -t4 -c4 -d10s http://localhost:3333`, the following results are obtained:

```
Running 10s test @ http://localhost:3333
4 threads and 4 connections
Thread Stats Avg Stdev Max +/- Stdev
Latency 1.63ms 1.73ms 39.68ms 97.16%
Req/Sec 668.25 229.27 1.03k 59.50%
26642 requests in 10.02s, 2.57MB read
Requests/sec: 2658.40
Transfer/sec: 262.21KB
```

As visible from the results, this can scale to thousands of requests every second, including doing a GeoIP2 request for the location.

## 📄 License

- Code: [MIT](./LICENSE) © [Koj](https://joinkoj.com)
- "ElasticSearch" is a trademark of Elastic NV
- "Amazon Web Services" and "AWS" are trademarks of Amazon.com, Inc.
