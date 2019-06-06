#!/usr/bin/env python3


import json
import unittest as ut

import numpy as np

from oceannavigator.backend.stats import calculate_stats


class TestStats(ut.TestCase):
    

    def setUp(self):
        self.test_dataset = "tests/testdata/nemo_test.nc"
        self.area_mesh = np.array(
            np.meshgrid(
                np.linspace(5, 10, 10),
                np.linspace(-150, -160, 10)
            )
        )


    def test_calculate_stats_returns_correct_stats(self):

        expected_stats = json.dumps({
            "votemper": {
                "sampled_points": 100,
                "mean": 301.0411682128906
            }
        })

        actual_stats = calculate_stats(self.test_dataset,
                                        ["votemper"],
                                        0,
                                        0,
                                        self.area_mesh)
        
        

        self.assertEqual(actual_stats, expected_stats)
