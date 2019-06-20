import csv
import schedule
import time
import os

from sns import tweetupdate
from PiM25 import PiM25

ACCESS_TOKEN = ''
ACCESS_TOKEN_SECRET = ''
CONSUMER_KEY = ''
CONSUMER_SECRET = ''
twitter_account = tweetupdate.TweetUpdate(ACCESS_TOKEN, ACCESS_TOKEN_SECRET, CONSUMER_KEY, CONSUMER_SECRET)

def cal_pm25():
    LOW = 0
    MODERATE = 36
    HIGH = 54
    PURPLE = 71
    if os.path.exists('record.csv') is False:
        print('no record!')
    else:
        with open('record.csv', 'r') as read_file:
            rd = [x for x in csv.reader(read_file)]
            if len(rd) - 1 < 3:
                print('not enough record')
                return 1
            last3_avg = (int(rd[-1][7]) + int(rd[-2][7]) + int(rd[-2][7])) / 3
            STATUS = 'LOW'
            if last3_avg >= PURPLE:
                STATUS = 'PURPLE'
            elif last3_avg >= HIGH:
                STATUS = 'HIGH'
            elif last3_avg >= MODERATE:
                STATUS = 'MODERATE'
            if STATUS != LOW:
                twitter_account.tweet_my_msg(datetime.now().strftime("%Y-%m-%d %H:%M:%S") + 'The PM2.5 status is *' + STATUS + '*')


schedule.every().hour.do(cal_pm25)
schedule.every(10).minutes.do(PiM25.run)

while True:
    schedule.run_pending()
    time.sleep(1)
