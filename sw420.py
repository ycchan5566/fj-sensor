import requests
import RPi.GPIO as gpio
from bs4 import BeautifulSoup as bs

#gpio input pin
pin = 15
gpio.setmode(gpio.BOARD)
gpio.setup(pin, gpio.IN)

print('fj-sensor is ready')

try:
    while True:
        if gpio.input(pin):
            html = requests.get('https://www.cwb.gov.tw/V7/modules/MOD_EC_Home.htm')
            html.encoding = 'UTF-8'
            soup = bs(html.text)
            table = soup.find('table', {'class': 'BoxTable'})
            table = table.find_all('tr')[1]
            #print(table.find_all('td'))

            row = []
            row.append([td.text.replace('\n', '') for td in table.find_all('td')])
            
            print(row[0][1] + ' '+row[0][6])


except KeyboardInterrupt:
    print "Exception: KeyboardInterrupt"

finally:
    gpio.cleanup() 
