"use strict";
/* global document, fetch */

const status = document.querySelector("#status");

fetch("http://127.0.0.1:47831/health")
  .then((response) => {
    if (!response.ok) throw new Error();
    status.textContent = "Connected to local Persona";
  })
  .catch(() => {
    status.textContent = "Persona is not reachable";
  });
