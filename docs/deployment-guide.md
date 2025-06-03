# North Sea Watch Deployment Guide

This document provides detailed steps on how to deploy the North Sea Watch project to Google Cloud Run.

## Prerequisites

1. Google Cloud account and project (north-sea-watch)
2. GitHub account and repository (https://github.com/NorthSeaWatch/north-sea-watch)
3. Cloudflare account and domain (northseawatch.org)
4. Google Cloud SDK installed locally

## Deployment Steps

### 1. Set Up Google Cloud Project

Ensure you have created a Google Cloud project and enabled the following APIs:

- Cloud Run API
- Cloud Build API
- Artifact Registry API
- Cloud SQL Admin API
- SQL Component API
- Service Usage API
- Compute Engine API (for load balancer)
- Certificate Manager API (for SSL certificates)

You can enable these APIs in the Google Cloud Console:
1. Visit https://console.cloud.google.com/apis/library?project=north-sea-watch
2. Search for and enable the above APIs

### 2. Create Artifact Registry Repository

Create a Docker repository to store container images:

```bash
# Create Docker repository in European region
gcloud artifacts repositories create docker-repo \
  --repository-format=docker \
  --location=europe-west4 \
  --description="Docker repository for North Sea Watch"
```

### 3. Set Up Service Account

Create a service account for GitHub Actions and grant necessary permissions:

```bash
# Create service account
gcloud iam service-accounts create github-actions --display-name="GitHub Actions"

# Grant permissions
gcloud projects add-iam-policy-binding north-sea-watch \
  --member="serviceAccount:github-actions@north-sea-watch.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding north-sea-watch \
  --member="serviceAccount:github-actions@north-sea-watch.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin"

gcloud projects add-iam-policy-binding north-sea-watch \
  --member="serviceAccount:github-actions@north-sea-watch.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### 4. Create Service Account Key

Create a service account key and add it to GitHub repository Secrets:

```bash
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@north-sea-watch.iam.gserviceaccount.com
```

Then, add the content of the `github-actions-key.json` file to your GitHub repository Secrets with the name `GCP_SA_KEY`.

Also, add the content of the `cloudsql-auth.json` file to your GitHub repository Secrets with the name `CLOUDSQL_AUTH_JSON`.

### 5. Configure Environment Variables

Ensure you have created the following environment variable files:

- `frontend/.env.production`
- `backend/.env.production`

These files should contain all the configurations needed for the production environment.

#### Environment Variable Handling

In our GitHub Actions workflow, we convert environment variables from `.env` files to JSON format, then pass them to Cloud Run using the `--env-vars-file` parameter. This method correctly handles environment variables containing special characters.

If you need to deploy manually, you can use the following commands to convert `.env` files to JSON format:

```bash
# Convert frontend environment variables to JSON
echo "{" > env.json
# Add NODE_ENV
echo "  \"NODE_ENV\": \"production\"," >> env.json
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip empty lines and comments
  if [[ -z "$line" || "$line" =~ ^# ]]; then
    continue
  fi
  # Extract key and value
  key=$(echo "$line" | cut -d= -f1)
  value=$(echo "$line" | cut -d= -f2-)
  # Add to JSON
  echo "  \"$key\": \"$value\"," >> env.json
done < frontend/.env.production
# Remove the last comma and close the JSON object
sed -i '$ s/,$//' env.json
echo "}" >> env.json

# Use during deployment
gcloud run deploy frontend \
  --env-vars-file env.json
```

### 6. Configure GitHub Actions

Ensure you have created the following GitHub Actions workflow files:

- `.github/workflows/deploy-frontend.yml`
- `.github/workflows/deploy-backend.yml`

These files define how to build and deploy the frontend and backend services.

### 7. Deploy Services

Push code to the main branch of your GitHub repository to trigger GitHub Actions workflows:

```bash
git add .
git commit -m "Configure production deployment"
git push origin main
```

You can view the deployment progress in the Actions tab of your GitHub repository.

## Domain Configuration Options

There are three ways to configure custom domains for your Cloud Run services:

1. **Cloud Run Domain Mapping** (Preview, limited availability)
2. **Global External Load Balancer** (Recommended for production)
3. **Firebase Hosting**

### Option 1: Cloud Run Domain Mapping

This option is simpler but has limitations and is in preview mode.

#### Step 1: Verify Domain Ownership

```bash
gcloud domains verify northseawatch.org
```

This command will open the Search Console verification page where you need to complete domain ownership verification.

#### Step 2: Check Verified Domains

```bash
gcloud domains list-user-verified
```

Ensure your domain `northseawatch.org` appears in the list.

#### Step 3: Create Domain Mappings

```bash
# Set default region
gcloud config set run/region europe-west4

# Create domain mappings
gcloud beta run domain-mappings create --service=frontend --domain=northseawatch.org
gcloud beta run domain-mappings create --service=frontend --domain=www.northseawatch.org
gcloud beta run domain-mappings create --service=backend --domain=api.northseawatch.org
```

#### Step 4: Get DNS Record Information

```bash
gcloud beta run domain-mappings describe --domain=northseawatch.org
gcloud beta run domain-mappings describe --domain=www.northseawatch.org
gcloud beta run domain-mappings describe --domain=api.northseawatch.org
```

#### Step 5: Configure DNS Records in Cloudflare

Add the DNS records returned by the previous commands to your Cloudflare DNS settings.

### Option 2: Global External Load Balancer

This option provides better control, reliability, and integration with other services.

#### Step 1: Delete Existing Domain Mappings (if any)

```bash
gcloud beta run domain-mappings delete --domain=northseawatch.org
gcloud beta run domain-mappings delete --domain=www.northseawatch.org
gcloud beta run domain-mappings delete --domain=api.northseawatch.org
```

#### Step 2: Create Network Endpoint Groups (NEGs)

```bash
# Create frontend service NEG
gcloud compute network-endpoint-groups create frontend-neg \
  --region=europe-west4 \
  --network-endpoint-type=serverless \
  --cloud-run-service=frontend

# Create backend service NEG
gcloud compute network-endpoint-groups create backend-neg \
  --region=europe-west4 \
  --network-endpoint-type=serverless \
  --cloud-run-service=backend
```

#### Step 3: Create Backend Services

```bash
# Create frontend backend service
gcloud compute backend-services create frontend-backend-service --global

# Create backend backend service
gcloud compute backend-services create backend-backend-service --global

# Add NEGs to backend services
gcloud compute backend-services add-backend frontend-backend-service \
  --global \
  --network-endpoint-group=frontend-neg \
  --network-endpoint-group-region=europe-west4

gcloud compute backend-services add-backend backend-backend-service \
  --global \
  --network-endpoint-group=backend-neg \
  --network-endpoint-group-region=europe-west4
```

#### Step 4: Create URL Map

```bash
# Create URL map, default to frontend service
gcloud compute url-maps create northseawatch-url-map \
  --default-service=frontend-backend-service

# First create path matcher, then add host rule
gcloud compute url-maps add-path-matcher northseawatch-url-map \
  --path-matcher-name="api-paths" \
  --default-service=backend-backend-service

# Add host rule to route api subdomain traffic to api-paths path matcher
gcloud compute url-maps add-host-rule northseawatch-url-map \
  --hosts="api.northseawatch.org" \
  --path-matcher-name="api-paths"
```

#### Step 5: Create SSL Certificate

```bash
# Create managed SSL certificate
gcloud compute ssl-certificates create northseawatch-cert \
  --domains=northseawatch.org,www.northseawatch.org,api.northseawatch.org \
  --global
```

#### Step 6: Create HTTPS Target Proxy

```bash
# Create HTTPS target proxy
gcloud compute target-https-proxies create northseawatch-https-proxy \
  --url-map=northseawatch-url-map \
  --ssl-certificates=northseawatch-cert
```

#### Step 7: Create Forwarding Rule

```bash
# Create global forwarding rule
gcloud compute forwarding-rules create northseawatch-https-rule \
  --global \
  --target-https-proxy=northseawatch-https-proxy \
  --ports=443
```

#### Step 8: Get Load Balancer IP Address

```bash
gcloud compute forwarding-rules describe northseawatch-https-rule \
  --global \
  --format="value(IPAddress)"
```

#### The following commands worked last time

```bash
gcloud compute forwarding-rules delete northseawatch-https-rule --global --quiet
gcloud compute target-https-proxies delete northseawatch-https-proxy --global --quiet
gcloud compute url-maps delete northseawatch-url-map --global --quiet
gcloud compute backend-services delete frontend-backend-service --global --quiet
gcloud compute backend-services delete backend-backend-service --global --quiet
gcloud compute network-endpoint-groups delete frontend-neg --region=europe-west4 --quiet
gcloud compute network-endpoint-groups delete backend-neg --region=europe-west4 --quiet
gcloud compute ssl-certificates delete northseawatch-cert --global --quiet
gcloud compute ssl-policies delete northseawatch-ssl-policy --global --quiet
gcloud compute network-endpoint-groups create frontend-neg --region=europe-west4 --network-endpoint-type=serverless --cloud-run-service=frontend
gcloud compute network-endpoint-groups create backend-neg --region=europe-west4 --network-endpoint-type=serverless --cloud-run-service=backend
gcloud compute backend-services create frontend-backend-service --global --protocol=HTTP2
gcloud compute backend-services create backend-backend-service --global --protocol=HTTP2
gcloud compute backend-services add-backend frontend-backend-service --global --network-endpoint-group=frontend-neg --network-endpoint-group-region=europe-west4
gcloud compute backend-services add-backend backend-backend-service --global --network-endpoint-group=backend-neg --network-endpoint-group-region=europe-west4
gcloud compute url-maps create northseawatch-url-map --default-service=frontend-backend-service
gcloud compute url-maps add-path-matcher northseawatch-url-map --path-matcher-name="api-paths" --default-service=backend-backend-service
gcloud compute url-maps add-host-rule northseawatch-url-map --hosts="api.northseawatch.org" --path-matcher-name="api-paths"
gcloud compute ssl-policies create northseawatch-ssl-policy --profile=COMPATIBLE --min-tls-version=1.0 --global
gcloud compute ssl-certificates create northseawatch-cert --domains=northseawatch.org,www.northseawatch.org,api.northseawatch.org --global
gcloud compute target-https-proxies create northseawatch-https-proxy --url-map=northseawatch-url-map --ssl-certificates=northseawatch-cert --ssl-policy=northseawatch-ssl-policy
gcloud compute forwarding-rules create northseawatch-https-rule --global --target-https-proxy=northseawatch-https-proxy --ports=443
gcloud compute forwarding-rules describe northseawatch-https-rule --global --format="value(IPAddress)"

gcloud compute ssl-certificates describe northseawatch-cert

nslookup northseawatch.org
nslookup www.northseawatch.org
nslookup api.northseawatch.org
```

#### Step 9: Update DNS Records in Cloudflare

In Cloudflare, delete all previous DNS records and add the following:

1. A record: `northseawatch.org` → [load balancer IP]
2. A record: `www.northseawatch.org` → [load balancer IP]
3. A record: `api.northseawatch.org` → [load balancer IP]

Ensure all records have proxy status set to "Proxied" (orange cloud icon).

### Option 3: Firebase Hosting

This option is simpler and more cost-effective for smaller projects.

#### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

#### Step 2: Login to Firebase

```bash
firebase login
```

#### Step 3: Initialize Firebase Project

```bash
mkdir firebase-hosting
cd firebase-hosting
firebase init hosting
```

#### Step 4: Configure Firebase to Redirect to Cloud Run

Create a `firebase.json` file with the following content:

```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "**",
        "run": {
          "serviceId": "frontend",
          "region": "europe-west4"
        }
      }
    ]
  }
}
```

For the API subdomain, create another site:

```bash
firebase hosting:sites:create api-northseawatch
```

Then create a `firebase.json` file with:

```json
{
  "hosting": {
    "site": "api-northseawatch",
    "rewrites": [
      {
        "source": "**",
        "run": {
          "serviceId": "backend",
          "region": "europe-west4"
        }
      }
    ]
  }
}
```

#### Step 5: Deploy Firebase Configuration

```bash
firebase deploy --only hosting
```

#### Step 6: Configure Custom Domains

In the Firebase console, add custom domains for each site.

## Manual Deployment (Alternative)

If you need to deploy services manually, you can use the following commands:

### Frontend

```bash
# Build Docker image
cd frontend
docker build --target production -t europe-west4-docker.pkg.dev/north-sea-watch/docker-repo/frontend:latest .

# Push image to Artifact Registry
docker push europe-west4-docker.pkg.dev/north-sea-watch/docker-repo/frontend:latest

# Convert environment variables to JSON
echo "{" > env.json
# Add NODE_ENV
echo "  \"NODE_ENV\": \"production\"," >> env.json
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip empty lines and comments
  if [[ -z "$line" || "$line" =~ ^# ]]; then
    continue
  fi
  # Extract key and value
  key=$(echo "$line" | cut -d= -f1)
  value=$(echo "$line" | cut -d= -f2-)
  # Add to JSON
  echo "  \"$key\": \"$value\"," >> env.json
done < .env.production
# Remove the last comma and close the JSON object
sed -i '$ s/,$//' env.json
echo "}" >> env.json

# Deploy to Cloud Run
gcloud run deploy frontend \
  --image europe-west4-docker.pkg.dev/north-sea-watch/docker-repo/frontend:latest \
  --platform managed \
  --region europe-west4 \
  --allow-unauthenticated \
  --port 80 \
  --env-vars-file env.json
```

### Backend

```bash
# Build Docker image
cd backend
docker build --target production -t europe-west4-docker.pkg.dev/north-sea-watch/docker-repo/backend:latest .

# Push image to Artifact Registry
docker push europe-west4-docker.pkg.dev/north-sea-watch/docker-repo/backend:latest

# Convert environment variables to JSON
echo "{" > env.json
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip empty lines and comments
  if [[ -z "$line" || "$line" =~ ^# ]]; then
    continue
  fi
  # Extract key and value
  key=$(echo "$line" | cut -d= -f1)
  value=$(echo "$line" | cut -d= -f2-)
  # Add to JSON
  echo "  \"$key\": \"$value\"," >> env.json
done < .env.production
# Remove the last comma and close the JSON object
sed -i '$ s/,$//' env.json
echo "}" >> env.json

# Deploy to Cloud Run
gcloud run deploy backend \
  --image europe-west4-docker.pkg.dev/north-sea-watch/docker-repo/backend:latest \
  --platform managed \
  --region europe-west4 \
  --allow-unauthenticated \
  --port 8000 \
  --env-vars-file env.json \
  --add-cloudsql-instances north-sea-watch:europe-west4:ais-database \
  --service-account cloud-sql-auth-proxy@north-sea-watch.iam.gserviceaccount.com \
  --timeout 5m
```

## Troubleshooting

If you encounter issues, check:

1. Google Cloud Run service logs
2. GitHub Actions workflow logs
3. Environment variable configuration
4. Service account permissions
5. Artifact Registry permissions and configuration

### Common Errors

1. **Image Push Permission Error**: Ensure the service account has `artifactregistry.admin` permission
2. **Cloud SQL Connection Error**:
   - In Cloud Run environment, Cloud SQL connections are handled automatically through Unix sockets, no need to manually start Cloud SQL Auth Proxy
   - Ensure DATABASE_URL environment variable uses `localhost` as hostname, e.g., `postgres://user:password@localhost:5432/database`
   - Ensure `--add-cloudsql-instances` parameter is correctly configured
   - Ensure the service account has access to Cloud SQL
   - For Django applications, ensure database connection is correctly configured in settings.py
3. **Domain Mapping Error**: Ensure the domain is correctly configured in Cloudflare and domain mapping command format is correct
4. **Environment Variable Format Error**: Use JSON format for environment variable files to avoid special character issues
5. **Command Parameter Format Error**: Note the parameter format, for `domain-mappings create` command, use `--region europe-west4` instead of `--region=europe-west4`
6. **Backend Container Startup Failure**:
   - Check if CMD or ENTRYPOINT in Dockerfile is correct
   - Ensure entrypoint.sh script has execution permissions
   - Verify if the application is correctly listening on the port specified by the PORT environment variable
   - Check if Cloud SQL connection is correctly configured
   - For Django applications, ensure ASGI/WSGI configuration is correct, module path should be `config.asgi:application` or `config.wsgi:application`
   - Ensure PYTHONPATH environment variable is correctly set to `/app`
   - Try using gunicorn instead of uvicorn to start the application
   - Increase deployment timeout using `--timeout 5m` parameter
7. **Insufficient Permissions**: Some operations (such as enabling APIs, viewing logs, creating domain mappings) may require higher permissions, these operations should be performed locally using an account with sufficient permissions, not through GitHub Actions
8. **SSL Handshake Failed**: When using Cloudflare with Google Cloud, you may encounter SSL handshake failures. Try setting Cloudflare's SSL/TLS encryption mode to "Flexible" temporarily, then gradually upgrade to "Full" mode once everything is working.

### Viewing Deployment Logs

If deployment fails, you can view logs locally using the following commands:

```bash
# View recent deployment logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=backend" --limit 50

# View logs for a specific revision
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=backend AND resource.labels.revision_name=backend-00001-xxx"
```

## Additional Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Artifact Registry Documentation](https://cloud.google.com/artifact-registry/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cloudflare Documentation](https://developers.cloudflare.com/)
- [Google Cloud Load Balancing Documentation](https://cloud.google.com/load-balancing/docs)
- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting) 