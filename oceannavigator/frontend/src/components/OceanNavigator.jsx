import React from "react";
import Map from "./Map.jsx";
import MapInputs from "./MapInputs.jsx";
import MapToolbar from "./MapToolbar.jsx";
import PointWindow from "./PointWindow.jsx";
import LineWindow from "./LineWindow.jsx";
import AreaWindow from "./AreaWindow.jsx";
import TrackWindow from "./TrackWindow.jsx";
import Class4Window from "./Class4Window.jsx";
import Permalink from "./Permalink.jsx";
import Options from "./Options.jsx";
import {Button, Modal} from "react-bootstrap";
import Icon from "./lib/Icon.jsx";
import Iframe from "react-iframe";
import ReactGA from "react-ga";
import WarningBar from "./WarningBar.jsx";

import { withTranslation } from "react-i18next";

import { 
  GetDatasetsPromise,
  GetVariablesPromise,
  GetTimestampsPromise
} from "../remote/OceanNavigator.js";

const stringify = require("fast-stable-stringify");
const LOADING_IMAGE = require("../images/bar_loader.gif").default;

function formatLatLon(latitude, longitude) {
  let formatted = "";
  formatted += Math.abs(latitude).toFixed(4) + " ";
  formatted += (latitude >= 0) ? "N" : "S";
  formatted += ", ";
  formatted += Math.abs(longitude).toFixed(4) + " ";
  formatted += (longitude >= 0) ? "E" : "W";
  
  return formatted;
}

class OceanNavigator extends React.Component {
  constructor(props) {
    super(props);

    ReactGA.ga("send", "pageview");

    this.state = {
      availableDatasets: [],
      datasetVariables: [],
      dataset: "giops_day",
      variable: "votemper",
      quiverVariable: "none",
      quantum: "day",
      variable_scale: [-5,30], // Default variable range for left/Main Map
      depth: 0,
      time: -1,
      starttime: -2, // Start time for Left Map
      scale: "-5,30", // Variable scale for left/Main Map
      scale_1: "-5,30", // Variable scale for Right Map
      plotEnabled: false, // "Plot" button in MapToolbar
      projection: "EPSG:3857", // Map projection
      showModal: false,
      vectortype: null,
      vectorid: null,
      busy: false, // Controls if the busyModal is visible
      basemap: "topo",
      showHelp: false,
      showCompareHelp: false,
      extent: [],
      setDefaultScale: false,
      dataset_compare: false, // Controls if compare mode is enabled
      dataset_1: {
        dataset: "giops_day",
        variable: "votemper",
        depth: 0,
        time: -1,
        starttime: -2,  // Start time for Right Map
        variable_scale: [-5,30], // Default variable range for Right Map
        quiverVariable: "none",
      },
      syncRanges: false, // Clones the variable range from one view to the other when enabled
      sidebarOpen: true, // Controls sidebar opened/closed status
      options: {
        // Interpolation
        interpType: "gaussian",
        interpRadius: 25,
        interpNeighbours: 10,
        // Map
        mapBathymetryOpacity: 0.75, // Opacity of bathymetry contours
        topoShadedRelief: false,    // Show hill shading (relief mapping) on topography
        bathymetry: true,           // Show bathymetry contours
        bathyContour: 'etopo1',
      },
      showObservationSelect: false,
      observationArea: [],
    };

    this.mapComponent = null;
    this.mapComponent2 = null;

    this.prevOptions = this.state.options;

    const preload = new Image();
    preload.src = LOADING_IMAGE;

    if (window.location.search.length > 0) {
      try {
        const querystate = JSON.parse(decodeURIComponent(window.location.search.replace("?query=", "")));
        $.extend(this.state, querystate);
      } catch(err) {
        console.error(err);
      }
      let url = window.location.origin;
      if (window.location.pathname != undefined) {
        url += window.location.pathname;
      }
      window.history.replaceState(null, null, url);
    }

    window.onpopstate = function(event) {
      if (event.state) {
        this.setState({
          showModal: false
        });
      }
    }.bind(this);

    // Function bindings (performance optimization)
    this.toggleSidebar = this.toggleSidebar.bind(this);
    this.toggleCompareHelp = this.toggleCompareHelp.bind(this);
    this.swapViews = this.swapViews.bind(this);
    this.updateState = this.updateState.bind(this);
    this.action = this.action.bind(this);
    this.closeModal = this.closeModal.bind(this);
    this.generatePermLink = this.generatePermLink.bind(this);
    this.updateOptions = this.updateOptions.bind(this);
    this.updateScale = this.updateScale.bind(this);
    this.setStartTime = this.setStartTime.bind(this);
  }

  // Opens/closes the sidebar state
  toggleSidebar() {
    this.setState({sidebarOpen: !this.state.sidebarOpen});
  }

  // Opens/closes the help modal for dataset comparison
  toggleCompareHelp() {
    this.setState({showCompareHelp: !this.state.showCompareHelp,});
  }

  // Swap all view-related state variables
  swapViews() {
    const newState = this.state;
    // "destructuring" from ES2015
    [newState.dataset, newState.dataset_1.dataset] = [newState.dataset_1.dataset, newState.dataset];    
    [newState.variable, newState.dataset_1.variable] = [newState.dataset_1.variable, newState.variable];
    [newState.depth, newState.dataset_1.depth] = [newState.dataset_1.depth, newState.depth];
    [newState.time, newState.dataset_1.time] = [newState.dataset_1.time, newState.time];
    [newState.scale, newState.scale_1] = [newState.scale_1, newState.scale];
    [newState.variable_scale, newState.dataset_1.variable_scale] = [newState.dataset_1.variable_scale, newState.variable_scale];
    [newState.starttime, newState.dataset_1.starttime] = [newState.dataset_1.starttime, newState.starttime];

    this.setState(newState);
  }

  // Turns off map drawing
  removeMapInteraction(mode) {
    this.mapComponent.removeMapInteractions(mode);
    if (this.mapComponent2) {
      this.mapComponent2.removeMapInteractions(mode);
    }
  }

  updateOptions(newOptions) {
    let options = null;
    if (newOptions == null) {
      options = this.prevOptions;
    }
    else {
      options = Object.assign({}, this.state.options);
      this.prevOptions = this.state.options;
      options.interpType = newOptions.interpType ? newOptions.interpType : options.interpType;
      options.interpRadius = newOptions.interpRadius ? newOptions.interpRadius : options.interpRadius;
      options.interpNeighbours = newOptions.interpNeighbours ? newOptions.interpNeighbours : options.interpNeighbours;
      options.mapBathymetryOpacity = newOptions.mapBathymetryOpacity ? newOptions.mapBathymetryOpacity : options.mapBathymetryOpacity;
      options.bathymetry = newOptions.bathymetry ? newOptions.bathymetry : options.bathymetry;
      options.topoShadedRelief = newOptions.topoShadedRelief ? newOptions.topoShadedRelief : options.topoShadedRelief;
      options.bathyContour = newOptions.bathyContour ? newOptions.bathyContour : options.bathyContour;
    }

    this.setState({options});
  }

  // Updates global app state
  updateState(key, value) {
    var newState = {};

    // Only updating one value
    if (typeof(key) === "string") {
      if (this.state[key] === value) {

        // Value hasn't changed
        return;
      }
      
      // Store the updated value
      newState[key] = value;

      switch (key) {
        case "scale":
          this.updateScale(key, value);
          return;
        case "scale_1":

          if (this.state.syncRanges) {
            newState.scale = value;
            newState.scale_1 = value;
          }
          break;
        case "dataset_0":

          if (value.dataset !== this.state.dataset) {
            this.changeDataset(value.dataset, value);
            return;
          }
          newState = value;
          break;

        case "showObservationSelect":
          if (!value) {
            newState['observationArea'] = [];
          }
          break;
      }

    }
    else {
      for (let i = 0; i < key.length; ++i) {
        switch(key[i]) {
          case "time":
            if (value[i] !== undefined) {
              newState.time = value[i];
            }
            break;
          default:
            newState[key[i]] = value[i];
        }
      }
    }
    this.setState(newState);
  }

  updateScale(key, value) {
    this.setState({
      scale: value
    });
  }

  setStartTime(time) {
    if (time.length > 24) {
      return time[time.length - 25].id;
    }
    return time[0].id;
  }

  changeDataset(dataset, state) {
    // Busy modal
    this.setState({
      busy: true,
    });
    

    // When dataset changes, so does time & variable list
    // TODO: also get changes for depth
    GetVariablesPromise(dataset).then(variableResult => {
      const variableData = variableResult.data;

      let newVariable = this.state.variable;
      const variableIds = variableData.map(v => { return v.id; });
      if(!variableIds.includes(this.state.variable)) {
        newVariable = variableData[0].id;
      }

      let newTime = 0;
      let newStarttime = 0;
      GetTimestampsPromise(dataset, newVariable).then(timestampResult => {
        const timeData = timestampResult.data;
        
        newTime = timeData[timeData.length - 1].id;
        newStarttime = this.setStartTime(timeData);
        if (state === undefined) {
          state = {};
        }
        state.dataset = dataset;
        state.variable = newVariable;
        state.time = newTime;
        state.starttime = newStarttime;
        state.quiverVariable = "none";
        state.busy = false;

        this.setState(state);
      },
      error => {
        console.error(error);
      });

    },
    error => {
      console.error(error);
    });
  }

  action(name, arg, arg2, arg3) {
    switch(name) {
      case "obs_point":
        // Enable point selection in both maps
        this.mapComponent.obs_point();
        if (this.mapComponent2) {
          this.mapComponent2.obs_point();
        }
        break;
      case "obs_area":
        if (typeof(arg) === "object") {
          this.setState({
            observationArea: arg,
            showObservationSelect: true,
          });
        } else {
          // Enable point selection in both maps
          this.mapComponent.obs_area();
          if (this.mapComponent2) {
            this.mapComponent2.obs_area();
          }
        }
        break;
      case "point":
        if (typeof(arg) === "object") {
          // The EnterPoint component correctly orders the coordinate
          // pair, so no need to swap it.
          if (arg2 === "enterPoint") {
            this.setState({
              point: [[arg[0], arg[1]]],
              modal: "point",
              names: [],
            });
          }
          // Drawing on the map results in a reversed coordinate pair
          // so swap it.
          else {
            this.setState({
              point: [[arg[1], arg[0]]],
              modal: "point",
              names: [],
            });
          }

          // Disable point selection in both maps
          this.removeMapInteraction("Point");
          ReactGA.event({
            category: "PointPlot",
            action: "click",
            label: "PointPlot"
          });

          this.showModal();
        } 
        else {
          // Enable point selection in both maps
          this.mapComponent.point();
          if (this.mapComponent2) {
            this.mapComponent2.point();
          }
        }
        break;
      case "line":
        if (typeof(arg) === "object") {
          this.setState({
            line: arg,
            modal: "line",
            names: [],
          });

          // Disable line drawing in both maps
          this.removeMapInteraction("Line");
          ReactGA.event({
            category: "LinePlot",
            action: "click",
            label: "LinePlot"
          });

          this.showModal();
        } else {
          // Enable line drawing in both maps
          this.mapComponent.line();
          if (this.mapComponent2) {
            this.mapComponent2.line();
          }
        }
        break;
      case "area":        
        if (typeof(arg) === "object") {
          // Disable area drawing on both maps
          this.setState({
            area: arg,
            modal: "area",
            names: [],
          });
          this.removeMapInteraction("Area");
          ReactGA.event({
            category: "AreaPlot",
            action: "click",
            label: "AreaPlot"
          });
          this.showModal();
        } else {
          // Enable area drawing on both maps
          this.mapComponent.area();
          if (this.mapComponent2) {
            this.mapComponent2.area();
          }
        }
        break;
      case "track":
        this.setState({
          track: arg,
          modal: "track",
          names: arg,
        });
        ReactGA.event({
          category: "TrackPlot",
          action: "click",
          label: "TrackPlot"
        });
        this.showModal();
        break;
      case "show":
        this.mapComponent.show(arg, arg2);
        if (this.mapComponent2) {
          this.mapComponent2.show(arg, arg2);
        }
        break;
      case "add":
        this.mapComponent.add(arg, arg2, arg3);
        if (this.mapComponent2) {
          this.mapComponent2.add(arg, arg2, arg3);
        }
        break;
      case "plot":
        this.showModal();
        break;
      case "reset":
        this.mapComponent.resetMap();
        if (this.mapComponent2) {
          this.mapComponent2.resetMap();
        }
        break;
      case "permalink":
        if (arg !== null) {
          this.setState({
            subquery: arg,
            showPermalink: true,
          });
        }
        else {
          this.setState({
            showPermalink: true,
          });
        }
        break;
      case "options":
        this.setState({showOptions: true,});
        break;
      case "help":
        this.setState({ showHelp: true,});
        break;
      default:
        console.error("Undefined", name, arg);
        break;
    }
  }

  showModal() {
    this.setState({
      showModal: true
    });
  }
  
  closeModal() {
    if (this.state.subquery) {
      this.setState({
        subquery: null,
        showModal: false,
      });
    } else {
      window.history.back();
    }
  }
  
  componentDidMount() {
    
    GetDatasetsPromise().then(result => {
      this.setState({
        availableDatasets: result.data,
      });
    },
    error => {
      console.error(error);
    });

    GetVariablesPromise(this.state.dataset).then(result => {
      this.setState({
        datasetVariables: result.data,
      });
    },
    error => {
      console.error(error);
    });

    // eslint-disable-next-line max-len
    GetTimestampsPromise(this.state.dataset, this.state.variable).then(result => {
      const timeData = result.data;

      const newTime = timeData[timeData.length - 1].id;
      const newStarttime = timeData[0].id;
      this.setState({
        time: newTime,
        starttime: newStarttime
      });
    },
    error => {
      console.error(error);
    });
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.showModal && !prevState.showModal) {
      window.history.replaceState(prevState, null, null);
      window.history.pushState(null, null, null);
    }
  }

  generatePermLink(subquery, permalinkSettings) {
    let query = {};
    // We have a request from Point/Line/AreaWindow component.
    if (this.state.subquery !== undefined) {
      query.subquery = this.state.subquery;
      query.showModal = true;
      query.modal = this.state.modal;
      query.names = this.state.names;
      // Hacky fix to remove a third "null" array member from corrupting
      // permalink URL.
      if (this.state.modal === "point" && this.state.point[0].length === 3) {
        query.point = [this.state.point[0].slice(0, 2)];
      }
      else {
        query[this.state.modal] = this.state[this.state.modal];
      }
    }
    // We have a request from the Permalink component.
    for (let setting in permalinkSettings) {
      if (permalinkSettings[setting] === true) {
        query[setting] = this.state[setting];
      }
    }

    return window.location.origin + window.location.pathname +
      `?query=${encodeURIComponent(stringify(query))}`;
  }

  render() {
    let modalContent = "";
    let modalTitle = "";

    switch (this.state.modal) {
      case "point":
        modalContent = (
          <PointWindow
            dataset={this.state.dataset}
            quantum={this.state.dataset_quantum}
            point={this.state.point}
            variable={this.state.variable}
            depth={this.state.depth}
            time={this.state.time}
            starttime={this.state.starttime}
            scale={this.state.scale}
            colormap={this.state.colormap}
            names={this.state.names}
            onUpdate={this.updateState}
            onUpdateOptions={this.updateOptions}
            init={this.state.subquery}
            dataset_compare={this.state.dataset_compare}
            dataset_1={this.state.dataset_1}
            action={this.action}
            showHelp={this.toggleCompareHelp}
            swapViews={this.swapViews}
          />
        );
        modalTitle = formatLatLon(
          this.state.point[0][0],
          this.state.point[0][1]
        );
        break;
      case "line":
        modalContent = (
          <LineWindow
            dataset_0={this.state}
            quantum={this.state.dataset_quantum}
            line={this.state.line}
            variable={this.state.variable}
            depth={this.state.depth}
            time={this.state.time}
            scale={this.state.scale}
            scale_1={this.state.scale_1}
            colormap={this.state.colormap}
            names={this.state.names}
            onUpdate={this.updateState}
            init={this.state.subquery}
            dataset_compare={this.state.dataset_compare}
            dataset_1={this.state.dataset_1}
            action={this.action}
            showHelp={this.toggleCompareHelp}
            swapViews={this.swapViews}
          />
        );

        modalTitle = "(" + this.state.line[0].map(function(ll) {
          return formatLatLon(ll[0], ll[1]);
        }).join("), (") + ")";
        break;
      case "area":
        modalContent = (
          <AreaWindow
            dataset_0={this.state}
            area={this.state.area}
            scale={this.state.scale}
            scale_1={this.state.scale_1}
            colormap={this.state.colormap}
            names={this.state.names}
            depth={this.state.depth}
            projection={this.state.projection}
            onUpdate={this.updateState}
            onUpdateOptions={this.updateOptions}
            init={this.state.subquery}
            dataset_compare={this.state.dataset_compare}
            dataset_1={this.state.dataset_1}
            showHelp={this.toggleCompareHelp}
            action={this.action}
            swapViews={this.swapViews}
            options={this.state.options}
          />
        );

        modalTitle = "";
        break;
      case "track":
        modalContent = (
          <TrackWindow
            dataset={this.state.dataset}
            quantum={this.state.dataset_quantum}
            track={this.state.track}
            variable={this.state.variable}
            scale={this.state.scale}
            names={this.state.names}
            depth={this.state.depth}
            onUpdate={this.updateState}
            init={this.state.subquery}
            action={this.action}
            obs_query={this.state.vectorid}
          />
        );

        modalTitle = "";
        break;
      case "class4":
        modalContent = (
          <Class4Window
            dataset={this.state.dataset}
            class4id={this.state.class4}
            init={this.state.subquery}
            action={this.action}
          />
        );
        modalTitle = "";
        break;
    }
    if (this.state.names && this.state.names.length > 0) {
      modalTitle = this.state.names.slice(0).sort().join(", ");
    }

    _("Loading");

    const contentClassName = this.state.sidebarOpen ? "content open" : "content";
    
    // Pick which map we need
    let map = null;
    if (this.state.dataset_compare) {
      
      const secondState = $.extend(true, {}, this.state);
      for (let i = 0; i < Object.keys(this.state.dataset_1).length; ++i) {
        const keys = Object.keys(this.state.dataset_1);
        secondState[keys[i]] = this.state.dataset_1[keys[i]];
      }
      map = <div className='multimap'>
        <Map
          ref={(m) => this.mapComponent = m}
          state={this.state}
          action={this.action}
          updateState={this.updateState}
          partner={this.mapComponent2}
          scale={this.state.scale}
          options={this.state.options}
          quiverVariable={this.state.quiverVariable}
        />
        <Map
          ref={(m) => this.mapComponent2 = m}
          state={secondState}
          action={this.action}
          updateState={this.updateState}
          partner={this.mapComponent}
          scale={this.state.scale_1}
          options={this.state.options}
        />
      </div>;
    } 
    else {
      map = <Map
        ref={(m) => this.mapComponent = m}
        state={this.state}
        action={this.action}
        updateState={this.updateState}
        scale={this.state.scale}
        options={this.state.options}
        quiverVariable={this.state.quiverVariable}
      />;
    }

    return (
      <div className='OceanNavigator'>
        <MapInputs
          state={this.state}
          swapViews={this.swapViews}
          changeHandler={this.updateState}
          showHelp={this.toggleCompareHelp}
          options={this.state.options}
          updateOptions={this.updateOptions}
          availableDatasets={this.state.availableDatasets}
          datasetVariables={this.state.datasetVariables}
        />
        <div className={contentClassName}>
          <MapToolbar
            action={this.action}
            plotEnabled={this.state.plotEnabled}
            dataset_compare={this.state.dataset_compare}
            updateState={this.updateState}
            toggleSidebar={this.toggleSidebar}
            toggleOptionsSidebar={this.toggleOptionsSidebar}
            showObservationSelect={this.state.showObservationSelect}
            observationArea={this.state.observationArea}
          />
          <WarningBar />
          {map}
        </div>

        <Modal
          show={this.state.showModal}
          onHide={this.closeModal}
          dialogClassName='full-screen-modal'
          backdrop={true}
        >
          <Modal.Header closeButton closeLabel={_("Close")}>
            <Modal.Title>{modalTitle}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {modalContent}
          </Modal.Body>
          <Modal.Footer>
            <Button
              onClick={this.closeModal}
            ><Icon icon="close" alt={_("Close")}/> {_("Close")}</Button>
          </Modal.Footer>
        </Modal>

        <Modal
          show={this.state.showPermalink}
          onHide={() => this.setState({showPermalink: false})}
          dialogClassName='permalink-modal'
          backdrop={true}
        >
          <Modal.Header closeButton closeLabel={_("Close")}>
            <Modal.Title><Icon icon="link" alt={_("Share Link")}/> {_("Share Link")}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Permalink
              generatePermLink={this.generatePermLink}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button
              onClick={() => this.setState({showPermalink: false})}
            ><Icon icon="close" alt={_("Close")}/> {_("Close")}</Button>
          </Modal.Footer>
        </Modal>

        <Modal
          show={this.state.showOptions}
          onHide={() => this.setState({showOptions: false})}
          dialogClassName='permalink-modal'
          backdrop={true}
        >
          <Modal.Header closeButton closeLabel={_("Close")}>
            <Modal.Title><Icon icon="gear" alt={_("Options")}/> {_("Options")}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Options 
              options={this.state.options}
              updateOptions={this.updateOptions}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button
              onClick={() => this.setState({showOptions: false})}
            ><Icon icon="close" alt={_("Close")}/> {_("Close")}</Button>
          </Modal.Footer>
        </Modal>

        <Modal
          show={this.state.showHelp}
          onHide={() => this.setState({showHelp: false})}
          dialogClassName='full-screen-modal'
          backdrop={true}
        >
          <Modal.Header closeButton closeLabel={_("Close")}>
            <Modal.Title><Icon icon="question" alt={_("Help")}/> {_("Help")}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Iframe 
              url="https://dfo-ocean-navigator.github.io/Ocean-Navigator-Manual/"
              height="768px"
              position="relative"
            />
          </Modal.Body>
          <Modal.Footer>
            <Button
              onClick={() => this.setState({showHelp: false})}
            ><Icon icon="close" alt={_("Close")}/> {_("Close")}</Button>
          </Modal.Footer>
        </Modal>

        <Modal
          show={this.state.showCompareHelp}
          onHide={this.toggleCompareHelp}
          bsSize="large"
          dialogClassName="helpdialog"
          backdrop={true}
        >
          <Modal.Header closeButton closeLabel={_("Close")}>
            <Modal.Title>{_("Compare Datasets Help")}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.toggleCompareHelp}><Icon icon="close" alt={_("Close")}/> {_("Close")}</Button>
          </Modal.Footer>
        </Modal>

        <Modal 
          show={this.state.busy}
          dialogClassName='busy-modal'
          backdrop
        >
          <Modal.Header>
            <Modal.Title>{_("Please Wait…")}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <img src={LOADING_IMAGE} alt={_("Loading")} />
          </Modal.Body>
        </Modal>
      </div>
    );
  }
}

export default withTranslation()(OceanNavigator);
