function load_nodes_table() {
  nodesTable = document.querySelector("#nodes");
  let i = 0;
  fetch("/nodes")
    .then((response) => response.json())
    .then((nodesList) => {
      //Once we fetch the list, we iterate over it
      nodesList.forEach((node) => {
        // console.log(node)
        // Create the table row
        row = document.createElement("tr");

        // Create the table data elements for the species and description columns
        var checkbox = document.createElement("INPUT");
        checkbox.type = "checkbox";
        checkbox.className = "nodes";
        checkbox.value = i;
        i = i + 1;
        var check = document.createElement("td");
        var name = document.createElement("td");
        name.innerHTML = node.name;
        var location = document.createElement("td");
        location.innerHTML = node.address;
        var description = document.createElement("td");
        description.innerHTML = node.description;

        // Add the data elements to the row
        check.appendChild(checkbox);
        row.appendChild(check);
        row.appendChild(name);
        row.appendChild(location);
        row.appendChild(description);

        nodesTable.appendChild(row);
      });
    });
}

async function getNodes() {
  let nodes = [];
  await fetch("/nodes")
    .then((response) => response.json())
    .then((nodesList) => {
      //Once we fetch the list, we iterate over it
      nodesList.forEach((node) => {
        nodes.push([
          node.name,
          node.address,
          node.scale_port,
          node.mpc_pub_key,
          node.scale_key,
        ]);
      });
    });
  return nodes;
}

function getSelectedIndexes(className) {
  var selectedNodes = [];
  var checkboxes = document.querySelectorAll("input:checked");

  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].className == className) {
      selectedNodes.push(parseInt(checkboxes[i].value));
    }
  }

  return selectedNodes;
}

function getSelectedValue(className) {
  var checkboxes = document.querySelectorAll("input:checked");

  var funcName;
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].className == className) {
      funcName = checkboxes[i].value;
    }
  }

  return funcName;
}

// var functList = ["avg", "max", "stats"]
// demo use of MPC computation
async function mpc_computation() {
  document.getElementById("errorMsg").style.display = "none";
  // get information about selected nodes
  var selectedNodesIndexes = getSelectedIndexes("nodes");
  if (selectedNodesIndexes.length != 3) {
    document.getElementById("errorMsg").innerText = "Error: select 3 nodes.";
    document.getElementById("errorMsg").style.display = "block";
    console.log("select 3 nodes");
    return;
  }
  let allNodes = await getNodes();
  let nodes = [
    allNodes[selectedNodesIndexes[0]],
    allNodes[selectedNodesIndexes[1]],
    allNodes[selectedNodesIndexes[2]],
  ];
  var nodesNames = nodes[0][0] + "," + nodes[1][0] + "," + nodes[2][0];

  // get information about selected nodes
  var selectedDatasets = getSelectedIndexes("datasets");
  if (selectedDatasets.length == 0) {
    document.getElementById("errorMsg").innerText =
      "Error: no dataset selected.";
    document.getElementById("errorMsg").style.display = "block";
    document.getElementById("errorMsg").style.color = "red";
    console.log("no dataset selected");
    return;
  }
  let datasets = await getDatasets();
  let datasetNames = "";
  let columns = datasets[selectedDatasets[0]][2].split(",");
  let allowedNodes = nodesNames.split(",");
  for (var i = 0; i < selectedDatasets.length; i++) {
    datasetNames = datasetNames + "," + datasets[selectedDatasets[i]][0];
    columns = columns.filter((value) =>
      datasets[selectedDatasets[i]][2].split(",").includes(value)
    );
    if (datasets[selectedDatasets[i]][3] != "all") {
      allowedNodes = allowedNodes.filter((value) =>
        datasets[selectedDatasets[i]][3].split(",").includes(value)
      );
    }
  }
  datasetNames = datasetNames.substring(1);

  if (columns.length == 0) {
    document.getElementById("errorMsg").innerText =
      "Error: datasets incompatible.";
    document.getElementById("errorMsg").style.display = "block";
    document.getElementById("errorMsg").style.color = "red";
    console.log("datasets incompatible");
    return;
  }
  if (allowedNodes.length != 3) {
    document.getElementById("errorMsg").innerText =
      "Error: a dataset not shared with the selected nodes.";
    document.getElementById("errorMsg").style.display = "block";
    document.getElementById("errorMsg").style.color = "red";
    console.log("a dataset not shared with the selected nodes");
    return;
  }

  // define the name of the function that will be computed
  var funcName = getSelectedValue("function");

  var params = {};
  if (funcName == "k-means") {
    params["NUM_CLUSTERS"] = document.getElementById("num_clusters").value;
    if ((!(parseInt(params["NUM_CLUSTERS"]) > 1)) || (parseInt(params["NUM_CLUSTERS"]) > 5)) {
      document.getElementById("errorMsg").innerText =
        "Error: input of number of clusters should at least 2 and at most 5.";
      document.getElementById("errorMsg").style.display = "block";
      document.getElementById("errorMsg").style.color = "red";
      console.log("error with input of number of clusters");
      return;
    }
    document.getElementById("errorMsg").innerText =
        "Computing k-means is a complex operation that might take some time.";
    document.getElementById("errorMsg").style.display = "block";
    document.getElementById("errorMsg").style.color = "black";
  }

  var progressBar = document.querySelector("progress[id=progressBar]");
  progressBar.removeAttribute("value");

  // generate public and private key of the buyer
  let keypair = GenerateKeypair();
  let pubKey = keypair[0];
  let secKey = keypair[1];

  // send requests
  console.log("Sending requests to manager");

  var msg = {
    NodesNames: nodesNames,
    Program: funcName,
    DatasetNames: datasetNames,
    ReceiverPubKey: pubKey,
    Params: JSON.stringify(params),
  };

  // timeout 1h
  let rawResponse
  try {
    rawResponse = await fetchWithTimeout("/compute", msg, {
      timeout: 60 * 60 * 1000,
    });
  }
  catch (err) {
    document.getElementById("errorMsg").innerText =
        "Error: " + err.message;
    document.getElementById("errorMsg").style.display = "block";
    document.getElementById("errorMsg").style.color = "red";
    console.log("error computing the function");
    return;
  }


  let response = await rawResponse.json();
  console.log("Response obtained");

  let res = JoinSharesShamir(
    pubKey,
    secKey,
    response[0].Result,
    response[1].Result,
    response[2].Result
  );

  // interpret the result
  let csvText = VecToCsvText(res, response[0].Cols, funcName);
  // console.log("result", csvText)

  download(csvText, "result.csv");

  progressBar.value = 100;
  document.getElementById("errorMsg").innerText =
    "Success: see downloaded file.";
  document.getElementById("errorMsg").style.display = "block";
  document.getElementById("errorMsg").style.color = "green";
}

function download(textToWrite, name) {
  var a = document.body.appendChild(document.createElement("a"));
  a.download = name;
  textToWrite = textToWrite.replace(/\n/g, "%0D%0A");
  a.href = "data:text/plain," + textToWrite;
  a.click();
}

async function fetchWithTimeout(resource, msg, options = {}) {
  const { timeout = 8000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "post",
      body: JSON.stringify(msg),
    });
    clearTimeout(id);
    return response;
  }
  catch (err) {
    return err.message
  }
}

async function mpc_computation2() {
  document.getElementById("errorMsg").style.display = "none";
  // get information about selected nodes
  var selectedNodesIndexes = getSelectedIndexes("nodes");

  let allNodes = await getNodes();
  let nodes = [
    allNodes[selectedNodesIndexes[0]],
    allNodes[selectedNodesIndexes[1]],
    allNodes[selectedNodesIndexes[2]],
  ];
  var nodesNames = nodes[0][0] + "," + nodes[1][0] + "," + nodes[2][0];

  // get information about selected nodes
  var selectedDatasets = getSelectedIndexes("datasets");
  if (selectedDatasets.length == 0) {
    document.getElementById("errorMsg").innerText =
      "Error: no dataset selected.";
    document.getElementById("errorMsg").style.display = "block";
    document.getElementById("errorMsg").style.color = "red";
    console.log("no dataset selected");
    return;
  }
  let datasets = await getDatasets();
  let datasetNames = "";
  let columns = datasets[selectedDatasets[0]][2].split(",");
  let allowedNodes = nodesNames.split(",");
  for (var i = 0; i < selectedDatasets.length; i++) {
    datasetNames = datasetNames + "," + datasets[selectedDatasets[i]][0];
    columns = columns.filter((value) =>
      datasets[selectedDatasets[i]][2].split(",").includes(value)
    );
    if (datasets[selectedDatasets[i]][3] != "all") {
      allowedNodes = allowedNodes.filter((value) =>
        datasets[selectedDatasets[i]][3].split(",").includes(value)
      );
    }
  }
  datasetNames = datasetNames.substring(1);

  if (columns.length == 0) {
    document.getElementById("errorMsg").innerText =
      "Error: datasets incompatible.";
    document.getElementById("errorMsg").style.display = "block";
    document.getElementById("errorMsg").style.color = "red";
    console.log("datasets incompatible");
    return;
  }
  if (allowedNodes.length != 3) {
    document.getElementById("errorMsg").innerText =
      "Error: a dataset not shared with the selected nodes.";
    document.getElementById("errorMsg").style.display = "block";
    document.getElementById("errorMsg").style.color = "red";
    console.log("a dataset not shared with the selected nodes");
    return;
  }

  // define the name of the function that will be computed
  var funcName = "avg";

  var params = {};
  if (funcName == "k-means") {
    params["NUM_CLUSTERS"] = document.getElementById("num_clusters").value;
    if ((!(parseInt(params["NUM_CLUSTERS"]) > 1)) || (parseInt(params["NUM_CLUSTERS"]) > 5)) {
      document.getElementById("errorMsg").innerText =
        "Error: input of number of clusters should at least 2 and at most 5.";
      document.getElementById("errorMsg").style.display = "block";
      document.getElementById("errorMsg").style.color = "red";
      console.log("error with input of number of clusters");
      return;
    }
    document.getElementById("errorMsg").innerText =
        "Computing k-means is a complex operation that might take some time.";
    document.getElementById("errorMsg").style.display = "block";
    document.getElementById("errorMsg").style.color = "black";
  }

  var progressBar = document.querySelector("progress[id=progressBar]");
  progressBar.removeAttribute("value");

  // generate public and private key of the buyer
  let keypair = GenerateKeypair();
  let pubKey = keypair[0];
  let secKey = keypair[1];

  // send requests
  console.log("Sending requests to manager");

  var msg = {
    NodesNames: nodesNames,
    Program: funcName,
    DatasetNames: datasetNames,
    ReceiverPubKey: pubKey,
    Params: JSON.stringify(params),
  };

  // timeout 1h
  let rawResponse
  try {
    rawResponse = await fetchWithTimeout("/compute", msg, {
      timeout: 60 * 60 * 1000,
    });
  }
  catch (err) {
    document.getElementById("errorMsg").innerText =
        "Error: " + err.message;
    document.getElementById("errorMsg").style.display = "block";
    document.getElementById("errorMsg").style.color = "red";
    console.log("error computing the function");
    return;
  }


  let response = await rawResponse.json();
  console.log("Response obtained");

  let res = JoinSharesShamir(
    pubKey,
    secKey,
    response[0].Result,
    response[1].Result,
    response[2].Result
  );

  // interpret the result
  //let csvText = VecToCsvText(res, response[0].Cols, funcName);

  var func = getSelectedValue("function");

  

   
   console.log(datasets[selectedDatasets[0]][0]);
   console.log(func);
   if (func == "avg") {
    fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
    .then(response => response.text())
    .then(text => {
      const rows = text.split('\n'); 
      const firstRow = rows[0]; 
  

      const headers = firstRow.split(',').map(header => header.trim());
  
   
      const averages = new Array(headers.length).fill(0);
      for (let i = 1; i < rows.length; i++) {
        const rowValues = rows[i].split(',');
        for (let j = 0; j < headers.length; j++) {
          averages[j] += parseFloat(rowValues[j]);
        }
      }
      for (let j = 0; j < headers.length; j++) {
        averages[j] /= (rows.length - 1);
      }

 
      const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${averages.join(',')}`;
  
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', "result.csv");
  
      link.click(); 
    });
   }

   if(func=="min"){
    fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
    .then(response => response.text())
    .then(text => {
      const rows = text.split('\n'); 
      const firstRow = rows[0]; 
  
      const headers = firstRow.split(',').map(header => header.trim());
  
      const minimums = new Array(headers.length).fill(Number.MAX_SAFE_INTEGER);
      for (let i = 1; i < rows.length; i++) {
        const rowValues = rows[i].split(',');
        for (let j = 0; j < headers.length; j++) {
          if(parseFloat(rowValues[j]) < minimums[j]){
              minimums[j] = parseFloat(rowValues[j]);
          }
        }
      }
 
  
      
      const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${minimums.join(',')}`;
  
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', "result.csv");
  
      link.click(); 
    });
   }
 
   if (func == "max") {
    fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
        .then(response => response.text())
        .then(text => {
            const rows = text.split('\n');
            const firstRow = rows[0];

            const headers = firstRow.split(',').map(header => header.trim());

            const maximums = new Array(headers.length).fill(Number.MIN_SAFE_INTEGER); 
            for (let i = 1; i < rows.length; i++) {
                const rowValues = rows[i].split(',');
                for (let j = 0; j < headers.length; j++) {
                    if (parseFloat(rowValues[j]) > maximums[j]) { 
                        maximums[j] = parseFloat(rowValues[j]);
                    }
                }
            }


     
            const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${maximums.join(',')}`;

            const link = document.createElement('a');
            link.setAttribute('href', csvContent);
            link.setAttribute('download', "result.csv");

            link.click(); 
        });
}

if (func == "absolute") {
  fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
  .then(response => response.text())
  .then(text => {
    const rows = text.split('\n');
    const firstRow = rows[0];

    const headers = firstRow.split(',').map(header => header.trim());

    const deviations = new Array(headers.length).fill(0);
    const averages = new Array(headers.length).fill(0);

    for (let i = 1; i < rows.length; i++) {
      const rowValues = rows[i].split(',');
      for (let j = 0; j < headers.length; j++) {

        averages[j] += parseFloat(rowValues[j]);


        deviations[j] += Math.abs(parseFloat(rowValues[j]) - averages[j]);
      }
    }

    for (let j = 0; j < headers.length; j++) {
      deviations[j] /= (rows.length - 1);
    }

    const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${deviations.join(',')}`;

    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', "result.csv");
    setTimeout(function() {
      console.log("Hello, world!");
    }, 10000);
    link.click(); // 触发下载
  });
}

 if(func=="quartile"){
  fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
  .then(response => response.text())
  .then(text => {
    const rows = text.split('\n'); 
    const firstRow = rows[0]; 

    const headers = firstRow.split(',').map(header => header.trim());

    const q1Values = new Array(headers.length).fill(0);
    for (let j = 0; j < headers.length; j++) {
      const columnData = [];
      for (let i = 1; i < rows.length; i++) {
        const rowValues = rows[i].split(',');
        if (!isNaN(parseFloat(rowValues[j]))) {
          columnData.push(parseFloat(rowValues[j]));
        }
      }
      // Sort the column data in ascending order
      columnData.sort((a, b) => a - b);

      // Calculate the index of Q1 in the sorted column data
      const q1Index = Math.floor(columnData.length / 4);

      // Calculate the Q1 value for the column
      q1Values[j] = columnData[q1Index];
    }

    // Construct the new CSV content with Q1 values
    const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${q1Values.join(',')}`;

    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', "result.csv");

    link.click(); // Trigger download
  });
 }

 if(func=="medium"){
  fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
  .then(response => response.text())
  .then(text => {
    const rows = text.split('\n'); 
    const firstRow = rows[0]; 

    const headers = firstRow.split(',').map(header => header.trim());

    const medianValues = new Array(headers.length).fill(0);
    for (let j = 0; j < headers.length; j++) {
      const columnData = [];
      for (let i = 1; i < rows.length; i++) {
        const rowValues = rows[i].split(',');
        if (!isNaN(parseFloat(rowValues[j]))) {
          columnData.push(parseFloat(rowValues[j]));
        }
      }
      // Sort the column data in ascending order
      columnData.sort((a, b) => a - b);

      // Calculate the median value for the column
      const n = columnData.length;
      const medianIndex = Math.floor(n / 2);
      medianValues[j] = n % 2 === 0 ? (columnData[medianIndex - 1] + columnData[medianIndex]) / 2 : columnData[medianIndex];
    }

    // Construct the new CSV content with median values
    const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${medianValues.join(',')}`;

    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', "result.csv");

    link.click(); // Trigger download
  });
 }


 if(func=="upperquartile"){
  fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
  .then(response => response.text())
  .then(text => {
    const rows = text.split('\n'); 
    const firstRow = rows[0]; 

    const headers = firstRow.split(',').map(header => header.trim());

    const q3Values = new Array(headers.length).fill(0);
    for (let j = 0; j < headers.length; j++) {
      const columnData = [];
      for (let i = 1; i < rows.length; i++) {
        const rowValues = rows[i].split(',');
        if (!isNaN(parseFloat(rowValues[j]))) {
          columnData.push(parseFloat(rowValues[j]));
        }
      }
      // Sort the column data in ascending order
      columnData.sort((a, b) => a - b);

      // Calculate the index of Q3 in the sorted column data
      const q3Index = Math.floor(columnData.length * 3 / 4);

      // Calculate the Q3 value for the column
      q3Values[j] = columnData[q3Index];
    }

    // Construct the new CSV content with Q3 values
    const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${q3Values.join(',')}`;

    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', "result.csv");

    link.click(); // Trigger download
  });
 }

 if(func=="variance"){
  fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
  .then(response => response.text())
  .then(text => {
    const rows = text.split('\n'); 
    const firstRow = rows[0]; 

    const headers = firstRow.split(',').map(header => header.trim());

    const sumValues = new Array(headers.length).fill(0);
    const sumSquares = new Array(headers.length).fill(0);

    // Calculate the sum and sum of squares for each column
    for (let i = 1; i < rows.length; i++) {
      const rowValues = rows[i].split(',');
      for (let j = 0; j < headers.length; j++) {
        if (!isNaN(parseFloat(rowValues[j]))) {
          sumValues[j] += parseFloat(rowValues[j]);
          sumSquares[j] += Math.pow(parseFloat(rowValues[j]), 2);
        }
      }
    }

    const variances = new Array(headers.length).fill(0);

    // Calculate the variance for each column
    for (let j = 0; j < headers.length; j++) {
      const n = rows.length - 1;
      const mean = sumValues[j] / n;
      const meanSquare = sumSquares[j] / n;
      const variance = meanSquare - Math.pow(mean, 2);
      variances[j] = variance.toFixed(3);
    }

    // Construct the new CSV content with variance values
    const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${variances.join(',')}`;

    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', "result.csv");

    link.click(); // Trigger download
  });

 }

 if(func=="standard"){
  fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
  .then(response => response.text())
  .then(text => {
    const rows = text.split('\n'); 
    const firstRow = rows[0]; 

    const headers = firstRow.split(',').map(header => header.trim());

    const sumValues = new Array(headers.length).fill(0);
    const sumSquares = new Array(headers.length).fill(0);

    // Calculate the sum and sum of squares for each column
    for (let i = 1; i < rows.length; i++) {
      const rowValues = rows[i].split(',');
      for (let j = 0; j < headers.length; j++) {
        if (!isNaN(parseFloat(rowValues[j]))) {
          sumValues[j] += parseFloat(rowValues[j]);
          sumSquares[j] += Math.pow(parseFloat(rowValues[j]), 2);
        }
      }
    }

    const variances = new Array(headers.length).fill(0);

    // Calculate the variance for each column
    for (let j = 0; j < headers.length; j++) {
      const n = rows.length - 1;
      const mean = sumValues[j] / n;
      const meanSquare = sumSquares[j] / n;
      const variance = meanSquare - Math.pow(mean, 2);
      const stdDev = Math.sqrt(variance);
      variances[j] = stdDev.toFixed(3);
    }

    // Construct the new CSV content with standard deviation values
    const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${variances.join(',')}`;

    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', "result.csv");

    link.click(); // Trigger download
  });
 }

 if(func=="sknewness"){
  fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
  .then(response => response.text())
  .then(text => {
    const rows = text.split('\n'); 
    const firstRow = rows[0]; 

    const headers = firstRow.split(',').map(header => header.trim());

    const sumValues = new Array(headers.length).fill(0);
    const sumSquares = new Array(headers.length).fill(0);
    const sumCubes = new Array(headers.length).fill(0);

    // Calculate the sum, sum of squares, and sum of cubes for each column
    for (let i = 1; i < rows.length; i++) {
      const rowValues = rows[i].split(',');
      for (let j = 0; j < headers.length; j++) {
        if (!isNaN(parseFloat(rowValues[j]))) {
          const value = parseFloat(rowValues[j]);
          sumValues[j] += value;
          sumSquares[j] += Math.pow(value, 2);
          sumCubes[j] += Math.pow(value, 3);
        }
      }
    }

    const skewnesses = new Array(headers.length).fill(0);

    // Calculate the skewness for each column
    for (let j = 0; j < headers.length; j++) {
      const n = rows.length - 1;
      const mean = sumValues[j] / n;
      const variance = (sumSquares[j] / n) - Math.pow(mean, 2);
      const stdDev = Math.sqrt(variance);
      const skewness = ((sumCubes[j] / n) - (3 * mean * sumSquares[j] / n) + (2 * Math.pow(mean, 3))) /
      (Math.pow(variance, 1.5) * (n / (n - 1)) * Math.sqrt((n - 2) / (n + 1)));
      skewnesses[j] = skewness.toFixed(3);
    }

    // Construct the new CSV content with skewness values
    const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${skewnesses.join(',')}`;

    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', "result.csv");

    link.click(); // Trigger download
  });
 }
 if(func=="kurtosis"){
  fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
  .then(response => response.text())
  .then(text => {
    const rows = text.split('\n'); 
    const firstRow = rows[0]; 

    const headers = firstRow.split(',').map(header => header.trim());

    const sumValues = new Array(headers.length).fill(0);
    const sumSquares = new Array(headers.length).fill(0);
    const sumCubes = new Array(headers.length).fill(0);
    const sumFourths = new Array(headers.length).fill(0);

    // Calculate the sum, sum of squares, sum of cubes, and sum of fourths for each column
    for (let i = 1; i < rows.length; i++) {
      const rowValues = rows[i].split(',');
      for (let j = 0; j < headers.length; j++) {
        if (!isNaN(parseFloat(rowValues[j]))) {
          const value = parseFloat(rowValues[j]);
          sumValues[j] += value;
          sumSquares[j] += Math.pow(value, 2);
          sumCubes[j] += Math.pow(value, 3);
          sumFourths[j] += Math.pow(value, 4);
        }
      }
    }

    const kurtoses = new Array(headers.length).fill(0);

    // Calculate the kurtosis for each column
    for (let j = 0; j < headers.length; j++) {
      const n = rows.length - 1;
      const mean = sumValues[j] / n;
      const variance = (sumSquares[j] / n) - Math.pow(mean, 2);
      const stdDev = Math.sqrt(variance);
      const kurtosis = ((sumFourths[j] / n) - (4 * mean * sumCubes[j] / n) + (6 * Math.pow(mean, 2) * sumSquares[j] / n) - (3 * Math.pow(mean, 4))) / Math.pow(stdDev, 4);
      kurtoses[j] = kurtosis.toFixed(3);
    }

    // Construct the new CSV content with kurtosis values
    const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${kurtoses.join(',')}`;

    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', "result.csv");

    link.click(); // Trigger download
  });

 }
  progressBar.value = 100;
  document.getElementById("errorMsg").innerText =
    "Success: see downloaded file.";
  document.getElementById("errorMsg").style.display = "block";
  document.getElementById("errorMsg").style.color = "green";
}