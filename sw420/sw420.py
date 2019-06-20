import requests
import RPi.GPIO as gpio
import time
from bs4 import BeautifulSoup as bs

#pin for sw sensor
pin = 15

#pin for beep
pin_alarm = 3

gpio.setmode(gpio.BOARD)
gpio.setup(pin, gpio.IN)
gpio.setup(pin_alarm, gpio.OUT)
p = gpio.PWM(pin_alarm, 659)

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
            time.sleep(5)
            p.stop()

except KeyboardInterrupt:
    print "Exception: KeyboardInterrupt"

finally:
    gpio.cleanup() 
