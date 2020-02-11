"""
Perform UI test on the Ocean Navigator
==========================
:Author: Samuel Babalola
:Created: 2020-02-11

This module contains functions for different tests
of the user interface of the navigator.
"""


import pyautogui as gui
import time
import yaml


# Open dimension config
with open('dimension_config.yaml', 'r') as f:
    config = yaml.load(f, Loader=yaml.FullLoader)

dimension = config['location']
paths = config['paths']
address = config['web_addresses']

# Set default sleep time
sleep = 5

def find_temperature_bar():
    screenWidth, screenHeight = gui.size()
    # Find the Chrome pin in task bar
    gui.moveTo(dimension['firefox_icon'])
    #Right click for a new window
    gui.click(button='right')
    gui.moveTo(dimension['new_firefox_window'])
    gui.click()
    time.sleep(sleep)
    # Go to Firefox search
    gui.moveTo(dimension['firefox_search'])
    gui.typewrite(address['ocean_navigator'])
    gui.press('enter')
    time.sleep(sleep)
    image_loc = gui.locateCenterOnScreen(
        paths['test_temperature'], confidence=0.7, grayscale=True)

    if image_loc is None:
        gui.alert(text='Hmmm shady stuff', title='Temperature bar not found', button='OK')
    else:
        gui.click(button='right', x=image_loc.x, y=image_loc.y)
        gui.alert(text='Temperature bar check complete!', title='Temperature bar', button='Close')

def main():
    find_temperature_bar()

if '__main__' == __name__:
    main()