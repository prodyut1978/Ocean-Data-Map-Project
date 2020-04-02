"""
Perform UI test on the Ocean Navigator
==========================
:Author: Samuel Babalola
:Created: 2020-02-11

This module contains functions for different tests
of the user interface of the navigator.
"""

import copy
from datetime import datetime
import pyautogui as gui
import time
import yaml

from dimension_config import (open_config, write_to_config)
from utils import (navigator_webpage, get_time, 
                   retry_location_test, move_et_click)


# Open configuration file

config = open_config()
dimension = config['location']
paths = config['paths']
address = config['web_addresses']
duration = config['duration']

# Results

area_index_results = {
    'Profile' : None,
    'Statistics' : 'Not tested',
}
area_index_times = copy.deepcopy(area_index_results)

# Set default sleep time
sleep = duration['sleep']
plot_render_sleep = duration['plot_render']
box_timeout = duration['box_timeout']


def draw_area():
    """

    Function performs UI test on the draw line
    functionality of the navigator. 
    
    Assumption, user ran the temperature bar test
    so firefox and the navigator page are open.
    """
    sleep = 1.7
    result = None
    # Navigate to Point icon
    time.sleep(sleep)
    # Calculate area icon position
    x = dimension['map_icon'][0] + 120
    move_et_click((x, dimension['map_icon'][1]))
    time.sleep(sleep)
    # Pick the point dropdown
    # Calculate pick point
    pick_y = dimension['draw_on_map'][1] + 15
    move_et_click((x, pick_y))
    time.sleep(sleep)
    # Draw a bounding box for line test
    start_point = dimension['map_point']
    direction = 80
    move_right = (start_point[0] + direction, start_point[1])
    move_down = (move_right[0], move_right[1] - direction)
    move_left = (move_down[0] - direction, move_down[1])
    move_up = (move_left[0], move_left[1] + direction)
    move_et_click(dimension['map_point'])
    move_et_click(move_right)
    move_et_click(move_down)
    move_et_click(move_left)
    move_et_click(move_up)
    gui.click(move_up)
    time.sleep(plot_render_sleep)
    gui.alert('Conducting test...', 'Wait', timeout=4000)
    # Find expected plot
    image_loc = gui.locateCenterOnScreen(
        paths['area_index'], confidence=0.3, grayscale=True)

    if image_loc is None:
        gui.alert(text='Area index not found!', title='UI test', button='OK', timeout=box_timeout)
        # Retry the test in case of slow network connection
        result = retry_location_test(paths['area_index'], 'Area Index')
    else:
        gui.alert(text='Area UI test complete!', title='UI test', button='Close', timeout=box_timeout)
        result = 'Test Completed'
    
    area_index_results['Profile'] = result
    area_index_times['Profile'] = get_time()
    # Close index sub-tab
    time.sleep(.30)
    gui.click(dimension['close_index'])
    time.sleep(.30)
    return area_index_results, area_index_times


def main():
    navigator_webpage()
    test = draw_area()

if __name__ == '__main__':
    main()