import re
import os
import subprocess

G5T_GPIO = 23
DEVICE_IP = subprocess.check_output(['hostname', '-I'])

# MAC address
mac = open('/sys/class/net/eth0/address').readline().upper().strip()
DEVICE_ID = mac.replace(':','')

# Tick time
with open('/proc/uptime', 'r') as f:
    try:
        tick = float(f.readline().split()[0])
    except:
        print("Error: reading /proc/uptime")


# Device information
device_info = { "CFPM1.0"   : -1, \
                "CFPM2.5"   : -1, \
                "CFPM10"    : -1, \
                "PM1"      : -1, \
                "PM25"      : -1, \
                "PM10"      : -1, \
                "temp"      : -1, \
                "humid"      : -1, \
                "date"      : "", \
                "time"      : "", \
                "device"    : "Raspberry_Pi", \
              }

