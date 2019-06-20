# -*- coding: UTF-8 -*-
import requests
import RPi.GPIO as gpio
import time
import datetime
import tweetupdate as tweet
import PttAuto as ptt
from bs4 import BeautifulSoup as bs

#pin for sw sensor
pin = 15

#pin for beep
pin_alarm = 3

gpio.setmode(gpio.BOARD)
gpio.setup(pin, gpio.IN)
gpio.setup(pin_alarm, gpio.OUT)
p = gpio.PWM(pin_alarm, 659)

host = 'ptt.cc'
user = 'Your ptt account'
password = 'Your ptt password'

ACCESS_TOKEN = ''
ACCESS_TOKEN_SECRET = ''
CONSUMER_KEY = ''
CONSUMER_SECRET = ''
test_acc = tweet.TweetUpdate(ACCESS_TOKEN, ACCESS_TOKEN_SECRET, CONSUMER_KEY, CONSUMER_SECRET)

print('fj-sensor is ready')

try:
    while True:
        if gpio.input(pin): 
            html = requests.get('https://www.cwb.gov.tw/V7/modules/MOD_EC_Home.htm')
            html.encoding = 'UTF-8'
            soup = bs(html.text)
            table = soup.find('table', {'class': 'BoxTable'})
            table = table.find_all('tr')[1]

            ## show the lastest earthquake information
            row = []
            row.append([td.text.replace('\n', '') for td in table.find_all('td')])
            print(row[0][1] + ' '+row[0][6])

            ## alarm starts
            p.start(50)
            ptt.login(host, user, password)
            ptt.post('test', u'地震', u'塊陶阿')
            ptt.disconnect()
            now = str(datetime.datetime.now())
            now = now[:-7]
            print ('start to tweet')
            test_acc.tweet_my_msg(now+'  Earthquake')
            print ('tweet updates')
            time.sleep(10)
            p.stop()

except KeyboardInterrupt:
    print "Exception: KeyboardInterrupt"

finally:
    gpio.cleanup() 
