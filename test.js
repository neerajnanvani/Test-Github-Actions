const fs = require('fs').promises;
const { parseString } = require('xml2js');

const DOWNLOAD_LINK_PREFIX = "https://download.moodle.org/download.php/stable";


function getStableCode(url) {
  const splitUrl = url.split("/");

  return splitUrl[3];
}


function generateLatestDownloadLink(version) {

  return `${DOWNLOAD_LINK_PREFIX}${version}/moodle-latest-${version}`;
}

function generateOtherDownloadLink(mainVersion, currentVersion) {

  return `${DOWNLOAD_LINK_PREFIX}${mainVersion}/moodle-${currentVersion}`;
}

/**
 * Function to create Requirement key values for version json
 * 
 * @param {object} singleEnvironmentObj - the environment file single object
 * @returns {object} - the requirements object
 */
function createRequirementsObject(singleEnvironmentObj) {

  const obj = {};

  const allDatabases = singleEnvironmentObj["DATABASE"][0]["VENDOR"];


  for (let i = 0; i < allDatabases.length; ++i) {

    obj[allDatabases[i]["name"][0]] = allDatabases[i]["version"][0];
  }

  obj["PHP"] = singleEnvironmentObj["PHP"][0]["version"][0];
  obj["requires"] = singleEnvironmentObj["requires"][0];

  return obj;
}


/**
 * 
 * @param {object} versionsData - the versions file data
 * @param {object} environmentData - the environment file data
 */
function mergeData(versionsData, environmentData) {

  console.log("Merging files")

  let last3LtsData = [];

  let foundltsCount = 0;

  let index = 0;

  // strip the last 3 lts versions data
  while (foundltsCount < 3 && index < versionsData["versions"].length) {

    if (versionsData["versions"][index]["isLTS"] === true) foundltsCount++;

    last3LtsData.push(versionsData["versions"][index]);

    ++index;
  }

  last3LtsData = last3LtsData.filter((currentLts) => currentLts["releases"].length );
  last3LtsData = last3LtsData.map((currentVersion) => {


    
      const stableCode = getStableCode(currentVersion["releases"][0]["upgradePath"]);

      const currentReleases = currentVersion["releases"].map((currentRelease, index) => {

        const downloadUrls = {
          "zip": "",
          "tgz": ""
        }

        // first version 
        if (index == 0) {
          const link = generateOtherDownloadLink(stableCode, currentVersion.name)
          downloadUrls.zip = `${link}.zip`;
          downloadUrls.tgz = `${link}.tgz`;
        }

        // latest versions
        else if (index == currentVersion["releases"].length - 1 && !currentRelease["notes"]) {
          const link = generateLatestDownloadLink(stableCode)
          downloadUrls.zip = `${link}.zip`;
          downloadUrls.tgz = `${link}.tgz`;
        }

        // normal versions
        else {
          const link = generateOtherDownloadLink(stableCode, currentRelease.name)
          downloadUrls.zip = `${link}.zip`;
          downloadUrls.tgz = `${link}.tgz`;
        }

        return { ...currentRelease, ...downloadUrls };
      })
  

    const copyOfRelease = { ...currentVersion };

    copyOfRelease.releases = currentReleases;

    return copyOfRelease;

  })

  // 
  const lastlts = last3LtsData[last3LtsData.length - 1].name;




  const environmentDataJson = environmentData;

  let tempIndex = 0;

  const allEnvironmentData = environmentDataJson["COMPATIBILITY_MATRIX"]["MOODLE"]


  while (tempIndex < allEnvironmentData.length) {
    if (allEnvironmentData[tempIndex]["version"][0] == lastlts) {
      break;
    }
    ++tempIndex;
  }

  const requirementData = {};

  while (tempIndex < allEnvironmentData.length) {

    requirementData[allEnvironmentData[tempIndex]["version"][0]] = createRequirementsObject(allEnvironmentData[tempIndex]);

    ++tempIndex;
  }

  for (let i = 0; i < last3LtsData.length; ++i) {

    let currentVersion = last3LtsData[i].name;

    if (!requirementData[currentVersion]) continue;

    last3LtsData[i]["requires"] = requirementData[currentVersion]["requires"];

    delete requirementData[currentVersion]["requires"];

    last3LtsData[i]["requirements"] = requirementData[currentVersion];

  }


  fs.writeFile('./data/versions.json', JSON.stringify(last3LtsData, null, 4), (err) => {
    if (err) throw err;
    console.log("Versions.json written successully");
  });

}

async function getFileData() {

  try {

    // Read the contents of the XML file
    const environmentXML = await fs.readFile('./environment/environment.xml');


    const versionsData = JSON.parse(await fs.readFile('versions.json', 'utf-8'));

    // Parse the XML data using the xml2js module
    parseString(environmentXML, { mergeAttrs: true }, (err, result) => {
      if (err) {
        throw err
      }
      const environmentData = JSON.parse(JSON.stringify(result));

      mergeData(versionsData, environmentData);
    });

  } catch (err) {
    console.log(err)
  }

}


console.log("Start executing function ");

getFileData();

