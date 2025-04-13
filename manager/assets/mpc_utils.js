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

        console.log('node : ', node)

        console.log('node.name : ', node.name)

        if(node.name == 'Paris_node') {
          node.name = '和平节点'
        } else if(node.name == 'Berlin_node') {
          node.name = '铁西节点'
        } else if(node.name == 'Rome_node') {
          node.name = '皇姑节点'
        } else if(node.name == 'Ljubljana_node') {
          node.name = '浑南节点'
        }

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

  if(funcName == 'avg' || funcName == 'stats' || funcName == 'k-means') {
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
  } else {  
     if(funcName == "min")  {
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
   
     if (funcName == "max") {
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
  
  if (funcName == "absolute") {
    fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
    .then(response => response.text())
    .then(text => {
      const rows = text.split('\n');
      const firstRow = rows[0];
  
      const headers = firstRow.split(',').map(header => header.trim());
      // 初始化平均值数组
      let averages = new Array(headers.length).fill(0);
      // 记录处理的数据个数
      let count = 0;
  
      // 使用在线算法计算平均值
      for (let i = 1; i < rows.length; i++) {
        const rowValues = rows[i].split(',');
        count++;
        for (let j = 0; j < headers.length; j++) {
          const value = parseFloat(rowValues[j]);
          // 使用递推公式：newAvg = oldAvg + (value - oldAvg) / count
          averages[j] = averages[j] + (value - averages[j]) / count;
        }
      }
  
      const absDeviationSums = new Array(headers.length).fill(0);
      for (let i = 1; i < rows.length; i++) {
        const rowValues = rows[i].split(',');
        for (let j = 0; j < headers.length; j++) {
          const value = parseFloat(rowValues[j]) || 0;
          absDeviationSums[j] += Math.abs(value - averages[j]);
        }
      }
      for (let j = 0; j < headers.length; j++) {
        absDeviationSums[j] /= (rows.length - 1)
      }
      const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${absDeviationSums.join(',')}`;
  
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', "result.csv");
      setTimeout(function() {
        console.log("Hello, world!");
      }, 10000);
      link.click(); // 触发下载
    });
  }
  
   if(funcName == "quartile") {
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
  
   if(funcName == "medium") {
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
  
  
   if(funcName == "upperquartile") {
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
  
   if(funcName == "variance") {
    fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
    .then(response => response.text())
    .then(text => {
      const rows = text.split('\n'); 
      const firstRow = rows[0]; 
  
      const headers = firstRow.split(',').map(header => header.trim());
      // 初始化平均值数组
      let averages = new Array(headers.length).fill(0);
      // 记录处理的数据个数
      let count = 0;
  
      let sumSquaredDiffs = new Array(headers.length).fill(0);
      for (let i = 1; i < rows.length; i++) {
        const rowValues = rows[i].split(',');
        count++;
        for (let j = 0; j < headers.length; j++) {
          const value = parseFloat(rowValues[j]);
          const oldAvg = averages[j];
          averages[j] = oldAvg + (value - oldAvg) / count;
          sumSquaredDiffs[j] += (value - oldAvg) * (value - averages[j]); // Welford's method
        }
      }
      // 计算总体方差
      const variances = sumSquaredDiffs.map(sum => sum / count);
      // Construct the new CSV content with variance values
      const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${variances.join(',')}`;
  
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', "result.csv");
  
      link.click(); // Trigger download
    });
  
   }
  
   if(funcName == "standard"){
    fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
    .then(response => response.text())
    .then(text => {
      const rows = text.split('\n'); 
      const firstRow = rows[0]; 
  
      const headers = firstRow.split(',').map(header => header.trim());
      let averages = new Array(headers.length).fill(0);
      let count = 0;
  
      let sumSquaredDiffs = new Array(headers.length).fill(0);
      for (let i = 1; i < rows.length; i++) {
        const rowValues = rows[i].split(',');
        count++;
        for (let j = 0; j < headers.length; j++) {
          const value = parseFloat(rowValues[j]);
          const oldAvg = averages[j];
          averages[j] = oldAvg + (value - oldAvg) / count;
          sumSquaredDiffs[j] += (value - oldAvg) * (value - averages[j]); // Welford's method
        }
      }
  
      // 计算总体方差（σ²）
      const variances = sumSquaredDiffs.map(sum => sum / count);
  
      // 计算总体标准差（σ = √σ²）
      const standardDeviations = variances.map(variance => Math.sqrt(variance));
  
      console.log("标准差:", standardDeviations);
  
      // Construct the new CSV content with standard deviation values
      const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${standardDeviations.join(',')}`;
  
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', "result.csv");
  
      link.click(); // Trigger download
    });
   }
  
   if(funcName == "sknewness") {
    fetch(`https://raw.githubusercontent.com/xiaoyuanxun/MPCService_Origin/master/data_provider/datasets/${datasets[selectedDatasets[0]][0]}`)
    .then(response => response.text())
    .then(text => {
      const rows = text.split('\n');
      const headers = rows[0].split(',').map(h => h.trim());
  
      // 初始化统计量：均值（mean）、M2（二阶矩）、M3（三阶矩）
      const stats = headers.map(() => ({
        mean: 0,
        M2: 0,
        M3: 0,
        n: 0,
      }));
  
      // Welford 增量计算
      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',');
        for (let j = 0; j < headers.length; j++) {
          const val = parseFloat(values[j]);
          if (isNaN(val)) continue;
  
          const { mean, M2, M3, n: count } = stats[j];
          const n1 = count + 1;
          const delta = val - mean;
          const delta_n = delta / n1;
          const term = delta * delta_n * count;
  
          // 更新统计量
          // 在Welford循环中修正M3的递推
          stats[j].M3 = M3 + delta * delta_n * delta_n * (n1 - 1) * (n1 - 2) - 3 * delta_n * M2;
          stats[j].M2 += term;
          stats[j].mean += delta_n;
          stats[j].n = n1;
        }
      }
      
      // 计算偏度（应用无偏调整）
      const skewnesses = stats.map(({ M2, M3, n: count }) => {
        if (count < 3) return NaN; // 样本量太小无法计算偏度
  
        const variance = M2 / (count - 1); // 无偏方差
        const skewness = (M3 / count) / Math.pow(variance, 1.5);
  
        // 小样本无偏调整因子
        const adjustment = Math.sqrt(count * (count - 1)) / (count - 2);
        return adjustment * skewness;
      });
  
      // Construct the new CSV content with skewness values
      const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${skewnesses.join(',')}`;
  
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', "result.csv");
  
      link.click(); // Trigger download
    });
   }

   if(funcName == "kurtosis"){
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
        kurtoses[j] = (kurtosis - 3).toFixed(3);
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
  // let rawResponse
  // try {
  //   rawResponse = await fetchWithTimeout("/compute", msg, {
  //     timeout: 60 * 60 * 1000,
  //   });
  // }
  // catch (err) {
  //   document.getElementById("errorMsg").innerText =
  //       "Error: " + err.message;
  //   document.getElementById("errorMsg").style.display = "block";
  //   document.getElementById("errorMsg").style.color = "red";
  //   console.log("error computing the function");
  //   return;
  // }


  // let response = await rawResponse.json();
  // console.log("Response obtained");

  // let res = JoinSharesShamir(
  //   pubKey,
  //   secKey,
  //   response[0].Result,
  //   response[1].Result,
  //   response[2].Result
  // );

  // interpret the result
  //let csvText = VecToCsvText(res, response[0].Cols, funcName);

  var func = getSelectedValue("function");

  

   
   console.log(datasets[selectedDatasets[0]][0]);
   console.log(func);

}