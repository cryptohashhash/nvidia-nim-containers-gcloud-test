#!/bin/bash

# 1. Kill any running ExpressVPN processes
echo "Killing ExpressVPN processes..."
killall ExpressVPN 2>/dev/null
killall expressvpnd 2>/dev/null

# 2. Remove the old app
echo "Removing ExpressVPN.app..."
sudo rm -rf /Applications/ExpressVPN.app

# 3. Remove preferences and caches
echo "Removing preferences and caches..."
rm -rf ~/Library/Application\ Support/com.expressvpn*
rm -rf ~/Library/Preferences/com.expressvpn*
rm -rf ~/Library/Caches/com.expressvpn*
rm -rf ~/Library/LaunchAgents/com.expressvpn*
sudo rm -rf /Library/LaunchDaemons/com.expressvpn*

# 4. Restart your Mac
echo "Rebooting..."
sudo reboot
