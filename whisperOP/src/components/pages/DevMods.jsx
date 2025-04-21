import React, { useState } from "react";
import axios from "axios";
import "./DevMods.css";

const DevMods = () => {
  const defaultConfig = {
    temperature: 0,
    best_of: 5,
    beam_size: 5,
    patience: null,
    length_penalty: null,
    suppress_tokens: "-1",
    initial_prompt: "",
    condition_on_previous_text: "True",
    fp16: "True",
    temperature_increment_on_fallback: 0.2,
    compression_ratio_threshold: 2.4,
    logprob_threshold: -1.0,
    no_speech_threshold: 0.6,
    word_timestamps: "False",
    prepend_punctuations: "'“¿([{-",
    append_punctuations: "'.。,，!！?？:：”)]}、",
    highlight_words: "False",
    max_line_width: null,
    max_line_count: null,
    max_words_per_line: null,
    threads: 0,
    clip_timestamps: "0",
    hallucination_silence_threshold: null,
    device: "cpu", // Add default device value
  };

  const [config, setConfig] = useState(defaultConfig);

  const handleChange = (key, value) => {
    if (typeof value === "boolean") {
      value = value ? "True" : "False";
    }
    setConfig({ ...config, [key]: value });
  };

  const resetConfig = () => {
    setConfig(defaultConfig);
  };

  const sendConfig = async () => {
    const transformedConfig = Object.fromEntries(
      Object.entries(config).map(([key, value]) => [
        key,
        typeof value === "boolean" ? (value ? "True" : "False") : value,
      ])
    );

    try {
      await axios.post("http://192.168.15.41:5000/settings", transformedConfig);
      alert("Configuration sent successfully!");
    } catch (error) {
      alert("Failed to send configuration.");
    }
  };

  return (
    <div className="neumorphic-container">
      <h1 className="neumorphic-title">DevMods Configuration</h1>
      <div className="neumorphic-content">
        {/* Temperature Slider */}
        <div className="neumorphic-control">
          <label>Temperature</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.temperature}
            onChange={(e) => handleChange("temperature", parseFloat(e.target.value))}
          />
          <span>{config.temperature}</span>
        </div>

        {/* Threads Slider */}
        <div className="neumorphic-control">
          <label>Threads Def</label>
          <input
            type="range"
            min="0"
            max="12"
            step="1"
            value={config.threads}
            onChange={(e) => handleChange("threads", parseInt(e.target.value, 10))}
          />
          <span>{config.threads}</span>
        </div>

        {/* Compression Ratio Threshold */}
        <div className="neumorphic-control">
          <label>Compression Ratio Threshold</label>
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={config.compression_ratio_threshold}
            onChange={(e) => handleChange("compression_ratio_threshold", parseFloat(e.target.value))}
          />
          <span>{config.compression_ratio_threshold}</span>
        </div>

        {/* No Speech Threshold */}
        <div className="neumorphic-control">
          <label>No Speech Threshold</label>
          <input
            type="range"
            min="0.1"
            max="1.5"
            step="0.1"
            value={config.no_speech_threshold}
            onChange={(e) => handleChange("no_speech_threshold", parseFloat(e.target.value))}
          />
          <span>{config.no_speech_threshold}</span>
        </div>

        {/* Device Dropdown */}
        <div className="neumorphic-control">
          <label>Device</label>
          <select
            value={config.device}
            onChange={(e) => handleChange("device", e.target.value)}
          >
            <option value="cpu">CPU</option>
            <option value="cuda">CUDA</option>
          </select>
        </div>

        <div className="flex gap-6 w-full">
          {/* Toggle Switch */}
          <div className="neumorphic-control w-1/2">
            <label>Condition on Previous Text</label>
            <div
              className={`neumorphic-toggle ${config.condition_on_previous_text === "True" ? "active" : ""
                }`}
              onClick={() =>
                handleChange(
                  "condition_on_previous_text",
                  config.condition_on_previous_text === "True" ? "False" : "True"
                )
              }
            >
              <div className="toggle-circle"></div>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="neumorphic-control w-1/2">
            <label>Float Point 16</label>
            <div
              className={`neumorphic-toggle ${config.fp16 === "True" ? "active" : ""
                }`}
              onClick={() =>
                handleChange(
                  "fp16",
                  config.fp16 === "True" ? "False" : "True"
                )
              }
            >
              <div className="toggle-circle"></div>
            </div>
          </div>
        </div>

        {/* Beam Size Input */}
        <div className="neumorphic-control">
          <label>Beam Size</label>
          <input
            type="number"
            min="1"
            max="10"
            value={config.beam_size}
            onChange={(e) => handleChange("beam_size", parseInt(e.target.value, 10))}
          />
        </div>

        {/* Action Buttons */}
        <div className="neumorphic-actions">
          <button onClick={sendConfig}>Send Configuration</button>
          <button onClick={resetConfig}>Reset to Default</button>
        </div>
      </div>
    </div>
  );
};

export default DevMods;
