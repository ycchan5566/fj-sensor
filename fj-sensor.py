import csv
import schedule
import subprocess
import time
import os

from PiM25 import PiM25

def cal_pm25():
    PiM25.run()
    LOW = 0
    MODERATE = 36
    HIGH = 54
    PURPLE = 71
    if os.path.exists('record.csv') is False:
        print('no record!')
    else:
        with open('record.csv', 'r') as read_file:
            rd = [x for x in csv.reader(read_file)]
            last3_avg = (int(rd[-1][7]) + int(rd[-2][7]) + int(rd[-2][7])) / 3
            print(last3_avg)

schedule.every(1).minutes.do(cal_pm25)

while True:
    schedule.run_pending()
    time.sleep(1)
