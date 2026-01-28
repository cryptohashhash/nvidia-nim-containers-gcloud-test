#!/bin/bash
set -e

PROJECT_ID="tiktok-via-antigravity"
ZONE="us-central1-c"
INSTANCE_NAME="nvidia-nim-speech-lab"
MACHINE_TYPE="g2-standard-4" # 1x L4 GPU, 4 vCPUs, 16GB RAM

echo "🚀 Deploying to Google Cloud (Project: $PROJECT_ID, Zone: $ZONE)..."

# 1. Enable Compute API
echo "Enable Compute API..."
gcloud services enable compute.googleapis.com --project $PROJECT_ID

# 2. PROVISION INSTANCE
if gcloud compute instances describe $INSTANCE_NAME --zone $ZONE --project $PROJECT_ID &> /dev/null; then
    echo "✅ Instance $INSTANCE_NAME already exists."
else
    echo "Creating G2 (L4) Instance. This may take a minute..."
    # Using Deep Learning VM image for pre-installed Drivers/Docker/NVIDIA Container Toolkit
    gcloud compute instances create $INSTANCE_NAME \
        --project $PROJECT_ID \
        --zone $ZONE \
        --machine-type $MACHINE_TYPE \
        --image-family=ubuntu-2204-lts \
        --image-project=ubuntu-os-cloud \
        --maintenance-policy=TERMINATE \
        --accelerator=type=nvidia-l4,count=1 \
        --boot-disk-size=200GB \
        --boot-disk-type=pd-ssd \
        --metadata-from-file=startup-script=startup.sh \
        --tags=http-server,https-server
    
    echo "Waiting for instance to initialize..."
    sleep 30
fi

# 3. FIREWALL RULES
echo "Configuring Firewall..."
gcloud compute firewall-rules create allow-nim-app-3000 \
    --project $PROJECT_ID \
    --allow tcp:3000 \
    --target-tags=http-server \
    --description="Allow traffic to NIM App" || true

# 4. PREPARE REMOTE ENV
echo "Preparing remote environment..."
IP_ADDRESS=$(gcloud compute instances describe $INSTANCE_NAME --zone $ZONE --project $PROJECT_ID --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo "🌍 Instance IP: $IP_ADDRESS"
echo "⏳ Waiting for SSH..."
until gcloud compute ssh $INSTANCE_NAME --zone $ZONE --project $PROJECT_ID --command "echo SSH Ready"; do
    sleep 5
    echo "Retrying SSH..."
done

# 5. UPLOAD CODE
echo "Uploading project files..."
# Create remote directory
gcloud compute ssh $INSTANCE_NAME --zone $ZONE --project $PROJECT_ID --command "mkdir -p ~/app"
# SCP files (excluding target/node_modules/artifacts)
rsync -avz --exclude 'target' --exclude 'node_modules' --exclude '.git' --exclude 'artifacts' ./ $INSTANCE_NAME:~/app/ \
    --rsh="gcloud compute ssh --zone $ZONE --project $PROJECT_ID"

# 6. DEPLOY
echo "---------------------------------------------------"
echo "✅ Setup Complete!"
echo "To finish deployment, run the following commands manually (to keep your API Key secure):"
echo ""
echo "1. SSH into the box:"
echo "   gcloud compute ssh $INSTANCE_NAME --zone $ZONE --project $PROJECT_ID"
echo ""
echo "2. Inside the box, run:"
echo "   cd ~/app"
echo "   export NVIDIA_API_KEY=<YOUR_KEY>"
echo "   docker login nvcr.io -u \$oauthtoken -p \$NVIDIA_API_KEY"
echo "   docker-compose up --build -d"
echo ""
echo "3. Access your app at: http://$IP_ADDRESS:3000"
echo "---------------------------------------------------"
