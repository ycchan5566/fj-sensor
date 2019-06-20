import time
import pigpio
import pprint
import subprocess
import signal
import sys
import os
import csv
from datetime import datetime

import PiM25.lib.G5T_module as G5T_m
import PiM25.lib.PiM25_config as Conf

def sigint_handle(sig, frame):
    try:
        pi = pigpio.pi()
        pi.bb_serial_read_close(Conf.G5T_GPIO)
        print("G5T close success")
    except Exception as e:
        print(e)

def run():
    signal.signal(signal.SIGINT, sigint_handle)
    ## initial PIGPIO library ##
    try:
        pidof_out = subprocess.check_output(['pidof', 'pigpiod'])
    except subprocess.CalledProcessError as e:
        print("pigpiod was not running")
        subprocess.check_output(['sudo', 'pigpiod'])
        time.sleep(0.5)
    try:
        pi = pigpio.pi()
    except Exception as e:
        print("initial pi fail, the error message is: ", e)
        sys.exit(1)

    ## collect all sensor data ##
    pms_data = Conf.device_info.copy()

    ## check pm2.5 sensor status ##
    EXIT_STATUS = 1

    ########## Read G5T ##########
    try:
        pi.bb_serial_read_open(Conf.G5T_GPIO, 9600)
        time.sleep(1)
        (s, raw_data) = pi.bb_serial_read(Conf.G5T_GPIO)
        G5T_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S").split(" ")
        if s:
            data_hex = G5T_m.bytes2hex(raw_data)
            pms_data, check = G5T_m.data_read(data_hex, pms_data)
            if check is 1:
                ## collect pm2.5 data ##
                EXIT_STATUS = 0

                ## record sensor time ##
                pms_data["date"] = (str(G5T_time[0]))
                pms_data["time"] = (str(G5T_time[1]))
                # pprint.pprint(pms_data)
        else:
            pprint.pprint(raw_data)
            EXIT_STATUS = 1

    except Exception as e:
        print(e)
        EXIT_STATUS = 1

    try:
        pi.bb_serial_read_close(Conf.G5T_GPIO)
        # print("G5T close success")
    except Exception as e:
        print(e)

    # Don't need to store msg if failed
    if EXIT_STATUS == 1:
        sys.exit(EXIT_STATUS)

    ########## Store msg ##########
    date = datetime.now().strftime("%Y-%m-%d %H:%M:%S").split(" ")

    info_key = ['device', 'date', 'time', 'CFPM1.0', 'CFPM2.5', 'CFPM10', 'PM1', 'PM25', 'PM10', 'humid', 'temp']
    if os.path.exists("record.csv") is False:
        with open("record.csv", "w") as output_file:
            dict_writer = csv.DictWriter(output_file, info_key)
            dict_writer.writeheader()

    with open("record.csv", "a") as output_file:
        try:
            dict_writer = csv.DictWriter(output_file, info_key)
            dict_writer.writerow(pms_data)
        except Exception as e:
            print(e)
            print("Error: writing to SD")

    pi.stop()
    sys.exit(EXIT_STATUS)


if __name__ == '__main__':
    run()
