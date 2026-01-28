#!/bin/bash
set -e
echo "🚀 Starting GPU Setup..."

# 1. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $USER

# 2. Install NVIDIA Drivers (L4 requires 525+, using 535)
add-apt-repository ppa:graphics-drivers/ppa -y
apt-get update
# Non-interactive install
DEBIAN_FRONTEND=noninteractive apt-get install -y nvidia-driver-535 nvidia-utils-535

# 3. Install NVIDIA Container Toolkit
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
  && curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

apt-get update
apt-get install -y nvidia-container-toolkit

# 4. Configure Docker
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker

echo "✅ GPU Setup Complete! Please reboot or load modules."
