import React, { useState, useEffect } from "react";
import { Card } from "react-bootstrap";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import DropdownButton from "react-bootstrap/DropdownButton";
import Form from "react-bootstrap/Form";
import ComboBox from "./ComboBox.jsx";
import CheckBox from "./lib/CheckBox.jsx";
import TimePicker from "./TimePicker.jsx";
import PropTypes from "prop-types";
import Icon from "./lib/Icon.jsx";
import { withTranslation } from "react-i18next";
import { GetVariablesPromise } from "../remote/OceanNavigator.js";

function SubsetPanel(props) {
  const [loading, setLoading] = useState(false);
  const [outputTimerange, setOutputTimerange] = useState(false);
  const [outputVariables, setOutputVariables] = useState([]);
  const [outputStarttime, setOutputStarttime] = useState(
    props.dataset.starttime
  );
  const [outputEndtime, setOutputEndtime] = useState(props.dataset.time);
  const [outputFormat, setOutputFormat] = useState("NETCDF4");
  const [zip, setZip] = useState(false);
  const [subset_variables, setSubset_variables] = useState([]);

  useEffect(() => {
    getSubsetVariables();
  }, [props.dataset.id]);

  useEffect(() => {
    if (outputTimerange && outputStarttime > outputEndtime) {
      let newStarttime = outputEndtime;
      let newEndtime = outputStarttime;
      setOutputStarttime(newStarttime);
      setOutputEndtime(newEndtime);
    }
  }, [outputStarttime, outputEndtime, outputTimerange]);

  // Find max extents of drawn area
  const calculateAreaBoundingBox = (area) => {
    let lat_min = area[0][0];
    let long_min = area[0][1];
    let lat_max = area[0][0];
    let long_max = area[0][1];

    for (let i = 0; i < area.length; ++i) {
      lat_min = Math.min(lat_min, area[i][0]);
      long_min = Math.min(long_min, area[i][1]);

      lat_max = Math.max(lat_max, area[i][0]);
      long_max = Math.max(long_max, area[i][1]);
    }

    return [lat_min, lat_max, long_min, long_max];
  };

  const subsetArea = () => {
    var queryString = [];
    // check if predefined area
    if (typeof props.area === "string" || props.area instanceof String) {
      queryString = "&area=" + props.area;
    } else {
      const AABB = calculateAreaBoundingBox(props.area);
      const min_range = [AABB[0], AABB[2]].join();
      const max_range = [AABB[1], AABB[3]].join();
      queryString = "&min_range=" + min_range + "&max_range=" + max_range;
    }
    const starttime = outputTimerange
      ? outputStarttime
      : outputEndtime;
    window.location.href =
      `/api/v2.0/subset/${props.dataset.id}/${outputVariables.join()}?` +
      "&output_format=" +
      outputFormat +
      queryString +
      "&time=" +
      [starttime, outputEndtime].join() +
      "&should_zip=" +
      (zip ? 1 : 0);
  };

  const saveScript = (key) => {
    let query = {
      outputFormat: outputFormat,
      dataset_name: props.dataset.id,
      variables: outputVariables.join(),
      time: [outputStarttime, outputEndtime].join(),
      should_zip: zip ? 1 : 0,
    };
    // check if predefined area
    if (typeof props.area === "string" || props.area instanceof String) {
      query["area"] = props.area;
    } else {
      const AABB = calculateAreaBoundingBox(props.area);
      query["min_range"] = [AABB[0], AABB[2]].join();
      query["max_range"] = [AABB[1], AABB[3]].join();
    }

    window.location.href =
      window.location.origin +
      "/api/v2.0/generate_script/?query=" +
      JSON.stringify(query) +
      "&lang=" +
      key +
      "&scriptType=subset";
  };

  const getSubsetVariables = () => {
    setLoading(true);
    GetVariablesPromise(props.dataset.id).then((variableResult) => {
      setLoading(false);
      setSubset_variables(variableResult.data);
    });
    setOutputStarttime(props.dataset.starttime);
    setOutputEndtime(props.dataset.time);
  };

  return (
    <div>
      <Card key="subset" variant="primary">
        <Card.Header>{__("Subset")}</Card.Header>
        <Card.Body>
          {loading ? null : (
            <>
              <ComboBox
                id="variable"
                key="variable"
                multiple={true}
                state={outputVariables}
                def={"defaults.dataset"}
                onUpdate={(keys, values) => {
                  setOutputVariables(values[0]);
                }}
                data={subset_variables}
                title={"Variables"}
              />
              <CheckBox
                id="time_range"
                key="time_range"
                checked={outputTimerange}
                onUpdate={(_, value) => {
                  setOutputTimerange(value);
                }}
                title={__("Select Time Range")}
              />
              <div style={{ display: outputTimerange ? "block" : "none" }}>
                <TimePicker
                  id="starttime"
                  key="starttime"
                  state={outputStarttime}
                  dataset={props.dataset}
                  title={
                    outputTimerange ? __("Start Time (UTC)") : __("Time (UTC)")
                  }
                  onUpdate={(_, value) => {
                    setOutputStarttime(value);
                  }}
                  max={outputTimerange ? outputEndtime : null}
                />
              </div>
              <TimePicker
                id="time"
                key="time"
                state={outputEndtime}
                dataset={props.dataset}
                title={
                  outputTimerange ? __("End Time (UTC)") : __("Time (UTC)")
                }
                onUpdate={(_, value) => {
                  setOutputEndtime(value);
                }}
                min={outputTimerange ? outputStarttime : null}
              />

              <Form.Group controlId="outputFormat">
                <Form.Label>{__("Output Format")}</Form.Label>
                <Form.Select
                  onChange={(e) => {
                    setOutputFormat(e.target.value);
                  }}
                  value={outputFormat}
                >
                  <option value="NETCDF4">{__("NetCDF-4")}</option>
                  <option value="NETCDF3_CLASSIC">
                    {__("NetCDF-3 Classic")}
                  </option>
                  <option value="NETCDF3_64BIT">{__("NetCDF-3 64-bit")}</option>
                  <option
                    value="NETCDF3_NC"
                    disabled={
                      props.dataset.id.indexOf("giops") === -1 &&
                      props.dataset.id.indexOf("riops") === -1 // Disable if not a giops or riops dataset
                    }
                  >
                    {"NetCDF-3 NC"}
                  </option>
                  <option value="NETCDF4_CLASSIC">
                    {__("NetCDF-4 Classic")}
                  </option>
                </Form.Select>
              </Form.Group>
              <CheckBox
                id="zip"
                key="zip"
                checked={zip}
                onUpdate={(_, checked) => {
                  setZip(checked);
                }}
                title={__("Compress as *.zip")}
              />
              <Button
                variant="default"
                key="save"
                id="save"
                onClick={subsetArea}
                disabled={outputVariables == ""}
              >
                <Icon icon="save" /> {__("Save")}
              </Button>
              <DropdownButton
                id="script"
                title={
                  <span>
                    <Icon icon="file-code-o" /> {__("API Scripts")}
                  </span>
                }
                variant={"default"}
                disabled={outputVariables == ""}
                onSelect={saveScript}
                drop={"up"}
              >
                <Dropdown.Item eventKey="python">
                  <Icon icon="code" /> {__("Python 3")}
                </Dropdown.Item>
                <Dropdown.Item eventKey="r">
                  <Icon icon="code" /> {__("R")}
                </Dropdown.Item>
              </DropdownButton>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

//***********************************************************************
SubsetPanel.propTypes = {
  id: PropTypes.string,
  key: PropTypes.string,
  dataset: PropTypes.object.isRequired,
  area: PropTypes.array.isRequired,
};

export default withTranslation()(SubsetPanel);
