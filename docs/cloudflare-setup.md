# Cloudflare Domain Configuration Guide

This document provides steps for configuring the northseawatch.org domain on Cloudflare to point to Google Cloud Run services or a load balancer.

## Prerequisites

1. Cloudflare account with northseawatch.org domain registered and managed
2. Frontend and backend services deployed to Google Cloud Run
3. (Option 1) Default domain names for Google Cloud Run services obtained
4. (Option 2) Load balancer IP address obtained

## Option 1: Configuring Cloudflare with Cloud Run Domain Mappings

### Step 1: Obtain Google Cloud Run Service Default URLs

After deploying services, Google Cloud Run assigns a default URL to each service in the format:
- Frontend: `frontend-xxxxx-xx.a.run.app`
- Backend: `backend-xxxxx-xx.a.run.app`

You can obtain these URLs using the following commands:

```bash
gcloud run services describe frontend --region europe-west4 --format="value(status.url)"
gcloud run services describe backend --region europe-west4 --format="value(status.url)"
```

### Step 2: Configure DNS Records in Cloudflare

Log in to the Cloudflare dashboard, select the northseawatch.org domain, and go to the DNS settings page. Add the following records:

1. For the main domain pointing to the frontend service:
   - Type: CNAME
   - Name: @
   - Target: frontend-xxxxx-xx.a.run.app
   - Proxy status: Proxied (orange cloud icon)

2. For the www subdomain pointing to the frontend service:
   - Type: CNAME
   - Name: www
   - Target: frontend-xxxxx-xx.a.run.app
   - Proxy status: Proxied (orange cloud icon)

3. For the API subdomain pointing to the backend service:
   - Type: CNAME
   - Name: api
   - Target: backend-xxxxx-xx.a.run.app
   - Proxy status: Proxied (orange cloud icon)

## Option 2: Configuring Cloudflare with Load Balancer

### Step 1: Obtain Load Balancer IP Address

After setting up the load balancer, obtain its IP address using:

```bash
gcloud compute forwarding-rules describe northseawatch-https-rule --global --format="value(IPAddress)"
```

### Step 2: Configure DNS Records in Cloudflare

Log in to the Cloudflare dashboard, select the northseawatch.org domain, and go to the DNS settings page. Add the following A records:

1. For the main domain:
   - Type: A
   - Name: @
   - Target: [Load Balancer IP Address]
   - Proxy status: Proxied (orange cloud icon)

2. For the www subdomain:
   - Type: A
   - Name: www
   - Target: [Load Balancer IP Address]
   - Proxy status: Proxied (orange cloud icon)

3. For the API subdomain:
   - Type: A
   - Name: api
   - Target: [Load Balancer IP Address]
   - Proxy status: Proxied (orange cloud icon)

### Step 3: Configure SSL/TLS Settings

In the Cloudflare dashboard, go to the SSL/TLS settings page:

1. Encryption mode: Select "Full" or "Full (Strict)"
2. Always use HTTPS: Enabled
3. Automatic HTTPS Rewrites: Enabled
4. TLS version: Minimum TLS 1.2

### Step 4: Configure Page Rules (Optional)

In the Cloudflare dashboard, go to the Page Rules settings page and add the following rules:

1. Force HTTPS:
   - URL match: `http://*northseawatch.org/*`
   - Setting: Always use HTTPS

2. Cache static resources (optional):
   - URL match: `*northseawatch.org/*.jpg*`
   - Setting: Cache Level: Standard

Repeat this rule for other static resource types (such as .png, .css, .js, etc.).

## Troubleshooting SSL Handshake Failures

If you encounter SSL handshake failures when using Cloudflare with Google Cloud, try the following steps:

### Step 1: Temporarily Change SSL/TLS Mode

1. In the Cloudflare dashboard, go to the SSL/TLS tab
2. Change the SSL/TLS encryption mode to "Flexible"
3. Save changes

### Step 2: Wait for Certificate Propagation

Wait for about 30 minutes to allow SSL certificates to be issued and propagated.

### Step 3: Gradually Upgrade SSL/TLS Mode

1. Once your site is accessible, try upgrading to "Full" mode
2. If that works, you can try "Full (Strict)" mode

### Step 4: Check for Cipher Suite Compatibility

If you continue to experience SSL handshake failures:
1. In the Cloudflare dashboard, go to the SSL/TLS tab
2. Select the "Edge Certificates" sub-tab
3. Ensure "TLS 1.3" is enabled
4. Try disabling "TLS 1.3 0-RTT" temporarily

## Verification

After configuration, verify that the following URLs work correctly:

- https://northseawatch.org
- https://www.northseawatch.org
- https://api.northseawatch.org

## Additional Resources

- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/)
- [Cloudflare SSL/TLS Documentation](https://developers.cloudflare.com/ssl/)
- [Google Cloud Run Domain Mapping Documentation](https://cloud.google.com/run/docs/mapping-custom-domains)
- [Google Cloud Load Balancing Documentation](https://cloud.google.com/load-balancing/docs) 