# vim: set fileencoding=utf-8 :

from mpl_toolkits.axes_grid1 import make_axes_locatable
import matplotlib.gridspec as gridspec
import matplotlib.pyplot as plt
import numpy as np
import re
import plotting.colormap
import plotting.utils
import plotting.line as plLine
from oceannavigator.util import (get_dataset_url, get_dataset_name)
from flask_babel import gettext
from data import open_dataset


class HovmollerPlotter(plLine.LinePlotter):

    def __init__(self, dataset_name, query, format):
        self.plottype = "hovmoller"
        super(HovmollerPlotter, self).__init__(dataset_name, query, format)

    def load_data(self):
        
        """
        Calculates and returns the depth, depth-value, and depth unit from a given dataset
        Args:
            depth: Stored depth information (self.depth or self.compare['depth'])
            clip_length: How many depth values to clip (usually len(dataset.depths) - 1)
            dataset: Opened dataset
        Returns:
            (depth, depth_value, depth_unit)
        """
        def find_depth(depth, clip_length, dataset):
            depth_value = 0
            depth_unit = "m"
            
            if depth:
                if depth == 'bottom':
                    depth_value = 'Bottom'
                    depth_unit = ''
                    return (depth, depth_value, depth_unit)
                else:
                    depth = np.clip(int(depth), 0, clip_length)
                    depth_value = np.round(dataset.depths[depth])
                    depth_unit = "m"
                    return (depth, depth_value, depth_unit)
            
            return (depth, depth_value, depth_unit)

        # Load left/primary view
        with open_dataset(get_dataset_url(self.dataset_name)) as dataset:
            
            latvar, lonvar = utils.get_latlon_vars(dataset)
            self.depth, self.depth_value, self.depth_unit = find_depth(self.depth, len(dataset.depths) - 1, dataset)

            self.fix_startend_times(dataset, self.starttime, self.endtime)
            time = range(self.starttime, self.endtime + 1)

            if len(self.variables) > 1:
                v = []
                for name in self.variables:
                    self.path_points, self.distance, t, value = dataset.get_path(
                        self.points,
                        self.depth,
                        time,
                        name
                    )
                    v.append(value ** 2)

                value = np.sqrt(np.ma.sum(v, axis=0))
                
                self.variable_name = self.get_variable_names(dataset, self.variables)[0]
                self.variable_name = self.vector_name(self.variable_name)
            else:
                self.path_points, self.distance, t, value = dataset.get_path(
                    self.points,
                    self.depth,
                    time,
                    self.variables[0]
                )
                self.variable_name = self.get_variable_names(dataset, self.variables)[0]

            variable_units = self.get_variable_units(dataset, self.variables)
            scale_factors = self.get_variable_scale_factors(dataset, self.variables)

            self.variable_unit, self.data = self.kelvin_to_celsius(variable_units[0], value)
            self.times = dataset.timestamps[self.starttime : self.endtime + 1]
            self.data = np.multiply(self.data, scale_factors[0])
            self.data = self.data.transpose()

            # Get colourmap
            if self.cmap is None:
                self.cmap = colormap.find_colormap(self.variable_name)

        # Load data sent from Right view (if in compare mode)
        if self.compare:
            with open_dataset(get_dataset_url(self.compare['dataset'])) as dataset:

                latvar, lonvar = utils.get_latlon_vars(dataset)
                self.compare['depth'], self.compare['depth_value'], self.compare['depth_unit'] = find_depth(self.compare['depth'], len(dataset.depths) - 1, dataset)

                self.fix_startend_times(dataset, self.compare['starttime'], self.compare['endtime'])
                time = range(self.compare['starttime'], self.compare['endtime'] + 1)

                if len(self.compare['variables']) > 1:
                    v = []
                    for name in self.compare['variables']:
                        path, distance, t, value = dataset.get_path(
                            self.points,
                            self.compare['depth'],
                            time,
                            name
                        )
                        v.append(value ** 2)

                    value = np.sqrt(np.ma.sum(v, axis=0))
                    self.compare['variable_name'] = self.get_variable_names(dataset, self.compare['variables'])[0]
                    self.compare['variable_name'] = self.vector_name(self.compare['variable_name'])
                else:
                    path, distance, t, value = dataset.get_path(
                        self.points,
                        self.compare['depth'],
                        time,
                        self.compare['variables'][0]
                    )
                    self.compare['variable_name'] = self.get_variable_names(dataset, self.compare['variables'])[0]

                # Colourmap
                if (self.compare['colormap'] == 'default'):
                    self.compare['colormap'] = colormap.find_colormap(self.compare['variable_name'])
                else:
                    self.compare['colormap'] = colormap.find_colormap(self.compare['colormap'])

                variable_units = self.get_variable_units(dataset, self.compare['variables'])
                scale_factors = self.get_variable_scale_factors(dataset, self.compare['variables'])

                self.compare['variable_unit'], self.compare['data'] = self.kelvin_to_celsius(variable_units[0], value)
                self.compare['times'] = dataset.timestamps[self.compare['starttime'] : self.compare['endtime'] + 1]
                self.compare['data'] = np.multiply(self.compare['data'], scale_factors[0])
                self.compare['data'] = self.compare['data'].transpose()

    # Render Hovmoller graph(s)
    def plot(self):
        
        def get_depth_label(depthValue, depthUnit):
            if depthValue == 'bottom':
                return " at Bottom"
            return " at %s %s" % (depthValue, depthUnit)

        # Figure size
        figuresize = map(float, self.size.split("x"))
        figuresize[1] *= 1.5 if self.compare else 1 # Vertical scaling of figure
        
        fig = plt.figure(figsize=figuresize, dpi=self.dpi)

        if self.showmap:
            width = 2 # 2 columns
            width_ratios = [2, 7]
        else:
            width = 1 # 1 column
            width_ratios = [1]

        # Setup grid (rows, columns, column/row ratios) depending on view mode
        if self.compare:
            gs = gridspec.GridSpec(2, width, width_ratios=width_ratios, height_ratios=[1, 1])
        else:
            gs = gridspec.GridSpec(1, width, width_ratios=width_ratios)

        if self.showmap:
            # Plot the path on a map
            plt.subplot(gs[:, 0])
            utils.path_plot(self.path_points)

        # Calculate variable range
        if self.scale:
            vmin = self.scale[0]
            vmax = self.scale[1]
        else:
            vmin = np.amin(self.data)
            vmax = np.amax(self.data)
            if np.any(map(
                lambda x: re.search(x, self.variable_name, re.IGNORECASE),
                [
                    "velocity",
                    "surface height",
                    "wind"
                ]
            )):
                vmin = min(vmin, -vmax)
                vmax = max(vmax, -vmin)
            
            if len(self.variables) > 1:
                vmin = 0

        # Render
        self._hovmoller_plot(
            gs, [0, 1], [0, 0],
            gettext(self.variable_name),
            vmin, vmax,
            self.data,
            self.times,
            self.cmap,
            self.variable_unit,
            gettext(self.variable_name) + gettext(get_depth_label(self.depth_value, self.depth_unit))
        )
        
        # If in compare mode
        if self.compare:
            # Calculate variable range
            if self.compare['scale']:
                vmin = self.compare['scale'][0]
                vmax = self.compare['scale'][1]
            else:
                vmin = np.amin(self.compare['data'])
                vmax = np.amax(self.compare['data'])
            if np.any(map(
                lambda x: re.search(x, self.compare['variable_name'], re.IGNORECASE),
                [
                    "velocity",
                    "surface height",
                    "wind"
                ]
            )):
                vmin = min(vmin, -vmax)
                vmax = max(vmax, -vmin)
            
            if len(self.compare['variables']) > 1:
                vmin = 0
            
            self._hovmoller_plot(
                gs, [1, 1], [1, 0],
                gettext(self.compare['variable_name']),
                vmin, vmax,
                self.compare['data'],
                self.compare['times'],
                self.compare['colormap'],
                self.compare['variable_unit'],
                gettext(self.compare['variable_name']) + gettext(get_depth_label(self.compare['depth'], self.compare['depth_unit']))
            )

            # TODO: Add difference plot

        # Image title
        fig.suptitle(gettext(u"Hovm\xf6ller Diagram(s) for:\n%s") % (
            self.name
        ), fontsize=15)

        # Subplot padding
        fig.tight_layout(pad=0, w_pad=4, h_pad=2)
        fig.subplots_adjust(top=0.85)

        return super(HovmollerPlotter, self).plot(fig)

    """
    Args:
        subplot: a GridSpec object (gs)
        map_subplot: Row number (Note: don't use consecutive rows to allow
                     for expanding figure height)
        nomap_subplot: Row index of subplot location when "Show Location" is
                       toggled off (consecutive works here)
        name: Nice name for variable of subplot
        vmin: minimum value for a variable (grabbed from the lowest value of some data)
        vmax: maxmimum value for a variable (grabbed from the highest value of some data)
        data: Data to be plotted
        times: Date range
        cmap: colormap for variable
        unit: variable unit
        title: Plot title
    """
    def _hovmoller_plot(self, subplot, map_subplot, nomap_subplot, name, vmin, vmax, data, times, cmap, unit, title):
        if self.showmap:
            plt.subplot(subplot[map_subplot[0], map_subplot[1]])
        else:
            plt.subplot(subplot[nomap_subplot[0], nomap_subplot[1]])

        c = plt.pcolormesh(self.distance, times, data,
                           cmap=cmap,
                           shading='gouraud', # Smooth shading
                           vmin=vmin,
                           vmax=vmax)
        ax = plt.gca()
        ax.set_title(title, fontsize=14) # Set title of subplot
        ax.yaxis_date()
        ax.yaxis.grid(True)
        ax.set_axis_bgcolor('dimgray')

        plt.xlabel(gettext("Distance (km)"))
        plt.xlim([self.distance[0], self.distance[-1]])

        divider = make_axes_locatable(plt.gca())
        cax = divider.append_axes("right", size="5%", pad=0.05)
        bar = plt.colorbar(c, cax=cax)
        bar.set_label("%s (%s)" % (name, utils.mathtext(unit)))