import time
import pigpio
import pprint
import subprocess
import os
import csv
from datetime import datetime

import lib.G5T_module as G5T_m
import lib.PiM25_config as Conf
# import lib.screen as lcd

if __name__ == '__main__':

    ## initial PIGPIO library ##
    try:
        pidof_out = subprocess.check_output(['pidof', 'pigpiod'])
    except subprocess.CalledProcessError as e:
        print("pigpiod was not running")
        subprocess.run(['sudo', 'pigpiod'], check=True)
        time.sleep(0.5)
    try:
        pi = pigpio.pi()
    except Exception as e:
        print("initial pi fail, the error message is: ", e)

    ## collect all sensor data ##
    weather_data = Conf.device_info.copy()

    ## check pm2.5 sensor status ##
    PM_STATUS = -1

    ## check gps sensor status ##
    LOCATION_STATUS = -1

    ## check OLED screen status ##
    SCREEN_STATUS = -1

    ########## Read G5T ##########
    try:
        pi.bb_serial_read_close(Conf.G5T_GPIO)
    except:
        print('Catch exception: pi.bb_serial_read_close(Conf.G5T_GPIO) at PiM25.py')

    try:
        pi.bb_serial_read_open(Conf.G5T_GPIO, 9600)
        time.sleep(1)
        (s, raw_data) = pi.bb_serial_read(Conf.G5T_GPIO)
        G5T_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S").split(" ")
        if s:
            print("read G5T")
            data_hex = G5T_m.bytes2hex(raw_data)
            weather_data, check  = G5T_m.data_read(data_hex, weather_data)
            if check is 1:
                ## collect pm2.5 data ##
                PM_STATUS = 1

                ## record sensor time ##
                weather_data["date"] = (str(G5T_time[0]))
                weather_data["time"] = (str(G5T_time[1]))
                pprint.pprint(weather_data)
        else:
            print("read nothing")
            pprint.pprint(raw_data)
            PM_STATUS = -1

    except Exception as e:
        print(e)
        PM_STATUS = -1

    try:
        pi.bb_serial_read_close(Conf.G5T_GPIO)
        print("G5T close success")
    except Exception as e:
        print(e)

    #############################

    # print("weather_data: ", weather_data)

    ########## Store msg ##########
    date = datetime.now().strftime("%Y-%m-%d %H:%M:%S").split(" ")

    info_key = weather_data.keys()
    store_data = [weather_data]
    if os.path.exists("record.csv") is False:
        with open("record.csv", "a") as output_file:
            dict_writer = csv.DictWriter(output_file, info_key)
            dict_writer.writeheader()

    with open("record.csv", "a") as output_file:
        try:
            dict_writer = csv.DictWriter(output_file, info_key)
            dict_writer.writerows(store_data)
        except Exception as e:
            print(e)
            print("Error: writing to SD")

    ##############################

    # lcd.display(weather_data)
    pi.stop()
    print("End")
