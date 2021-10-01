const arrayToMap = function (array) {
    return array.reduce((map, obj) => {
        obj.name = null;
        map.set(obj.id, obj);
        return map;
    }, new Map());
}

const mapToArray = function (map) {
    let array = []
    map.forEach((value, key) => {
        value.id = key;
        array.push(value);
    });
    return array;
}

const fieldSorterOptimized = function (fields) {
    var dir = [],
        i,
        l = fields.length;
    fields = fields.map(function (o, i) {
        if (o[0] === "-") {
            dir[i] = -1;
            o = o.substring(1);
        } else {
            dir[i] = 1;
        }
        return o;
    });

    return function (a, b) {
        for (i = 0; i < l; i++) {
            var o = fields[i];
            if (a[o] > b[o]) return dir[i];
            if (a[o] < b[o]) return -dir[i];
        }
        return 0;
    };
}

const objectsEqual = (o1, o2) => {
    var objectsAreSame = true;
    for (var propertyName in o1) {
        if (o1[propertyName] !== o2[propertyName]) {
            objectsAreSame = false;
            break;
        }
    }
    return objectsAreSame;
};

const arraysObjEqual = function (a1, a2) {
    return (a1.length === a2.length && a1.every((o, idx) => objectsEqual(o, a2[idx])));
};

/**
 * 
 * @param {Array} data raw Path data
 * @param {Boolean} mapScenes 
 * @returns {Array} Organized Path data
 */
const setPaths = function (data) {

    data = data.filter(e =>
        e.EventName != "Launch_HeatMap" && e.EventName != "Launch_TopicClick"
    )
    //Separate all sessions by regrouping all data by sessionID
    let reduced = data.reduce((acc, e) => {
        if (!acc[e.SessionId]) {
            acc[e.SessionId] = {}
            acc[e.SessionId].id = e.SessionId
            acc[e.SessionId].name = e.LearnerName
            acc[e.SessionId].actions = []
        }
        acc[e.SessionId].actions.push(e)
        return acc
    }, {})
    reduced = Object.values(reduced)
    //Iterate through every session and separate scenes
    reduced.forEach(e => {
        let indexesOfChangeWorld = e.actions.reduce((acc, val, index) => {
            if (val.EventName == "Launch_ChangeWorld") {
                acc.push(index)
            }
            return acc
        }, [])
        e.scenes = []
        for (let i = 0; i < indexesOfChangeWorld.length; i++) {

            let currentSceneActions = e.actions.slice(indexesOfChangeWorld[i], indexesOfChangeWorld[i + 1])
            let currentScene = {
                duration: currentSceneActions[currentSceneActions.length - 1].EventTime - currentSceneActions[0].EventTime,
                enterTime: currentSceneActions[0].EventTime,
                fromScene: i == 0 ? "Start_Experience" : e.actions[indexesOfChangeWorld[i - 1]].SceneName,
                scene: currentSceneActions[0].SceneName,
                zonesFound: currentSceneActions.filter(e => e.EventName == "Launch_QcmAnswerClick").map(e=>({tag:e.TagName, time:e.EventTime})),
                zonesScored: currentSceneActions.filter(e => e.EventName == "Launch_WinStar").map(e=>({tag:e.TagName, time:e.EventTime})),
                actions: currentSceneActions
            }
            e.scenes.push(currentScene)
        }

    })

    console.log('setpath');
    console.log(reduced)

    return reduced;
}

/**
 * 
 * @param {Array} paths Organized path data
 * @param {Map} mapScenes Map of available scenes
 * @param {Boolean} merge_themes 
 * @returns Array computed path data
 */
const computePaths = function (paths, mapScenes, merge_themes) {
    let computedPaths = [];
    paths.forEach((p, id) => {
        //reduce path to array of scenes
        let path = [];
        let acc = -1;
        //iterate on each scene of a path fuse them by category/theme based on option
        p.scenes.forEach((s) => {
            //ensure that the scene is allowed
            if (s.whitelisted) {
                //if it's the first scene of a path, add it's category, and register scene's personal data in scenes field
                if (acc == -1) {
                    acc++;
                    let found = s.zonesFound.map((e) => {
                        return { tag: e.tag, time: e.time };
                    }); //avoid passing a proxy as a parameter
                    let scored = s.zonesScored.map((e) => {
                        return { tag: e.tag, time: e.time };
                    }); //only for lisibility in console
                    path.push({
                        id: acc,
                        category: mapScenes.get(s.scene).category,
                        theme: merge_themes ? "---" : mapScenes.get(s.scene).theme,
                        scenes: [
                            {
                                username: p.name,
                                name: s.scene,
                                duration: s.duration,
                                zonesFound: found,
                                zonesScored: scored,
                            },
                        ],
                    });

                    //if a scene is already registered in this path
                } else {
                    //check if the scne has the same properties (category and theme based on options) of the previous one in the list
                    const obj1 = { category: path[acc].category };
                    const obj2 = { category: mapScenes.get(s.scene).category };
                    if (!merge_themes) {
                        obj1.theme = path[acc].theme;
                        obj2.theme = mapScenes.get(s.scene).category;
                    }
                    //if different properties, add a new category in the path
                    if (!objectsEqual(obj1, obj2)) {
                        acc++;
                        let found = s.zonesFound.map((e) => {
                            return { tag: e.tag, time: e.time };
                        }); //avoid passing a proxy as a parameter
                        let scored = s.zonesScored.map((e) => {
                            return { tag: e.tag, time: e.time };
                        }); //only for lisibility in console
                        path.push({
                            id: acc,
                            category: mapScenes.get(s.scene).category,
                            theme: merge_themes ? "---" : mapScenes.get(s.scene).theme,
                            scenes: [
                                {
                                    username: p.name,
                                    name: s.scene,
                                    duration: s.duration,
                                    zonesFound: found,
                                    zonesScored: scored,
                                },
                            ],
                        });
                        //if not, add scene's properties to the category on the path
                    } else {
                        let found = s.zonesFound.map((e) => {
                            return { tag: e.tag, time: e.time };
                        }); //avoid passing a proxy as a parameter
                        let scored = s.zonesScored.map((e) => {
                            return { tag: e.tag, time: e.time };
                        }); //only for lisibility in console
                        path[acc].scenes.push({
                            username: p.name,
                            name: s.scene,
                            duration: s.duration,
                            zonesFound: found,
                            zonesScored: scored,
                        });
                    }
                }
            }
        });

        //now that the path es reduced, check if a similar computed path exists, excluding scene's personnal properties
        const i = computedPaths.findIndex((d) => {
            if (d.path.length == path.length) {
                return d.path.every((element, index) => {
                    return objectsEqual(
                        {
                            id: element.id,
                            category: element.category,
                            theme: element.theme,
                        },
                        {
                            id: path[index].id,
                            category: path[index].category,
                            theme: path[index].theme,
                        }
                    );
                });
            }
            return false;
        });
        if (i == -1) {
            let tmp = [];
            path.forEach((e) =>
                tmp.push({
                    id: e.id,
                    category: e.category,
                    theme: e.theme,
                    scenes: [e.scenes],
                })
            );
            computedPaths.push({
                id: id,
                path: tmp,
                entries: 1,
                proportion: 0,
                users: [
                    {
                        id: "1",
                        username: "mrX",
                    },
                ],
            });
        } else {
            computedPaths[i].entries += 1;
            computedPaths[i].users.push({
                id: "2+",
                username: "mrZZZ",
            });
            computedPaths[i].path.forEach((p, ind) =>
                p.scenes.push(path[ind].scenes)
            );
        }


    });

    //find the proportion of usage of each path
    computedPaths.forEach((p) => {
        p.proportion =
            (p.entries / computedPaths.reduce((a, b) => +a + +b.entries, 0)) *
            100;
    });
    //sort paths by proportion
    computedPaths = computedPaths.sort((a, b) =>
        a.proportion < b.proportion ? 1 : b.proportion < a.proportion ? -1 : 0
    );


    console.log("Computed Path");
    console.log(computedPaths);

    return analyseComputedPaths(computedPaths, mapScenes);
}

/**
 * 
 * @param {Array} computedPaths 
 * @param {Map} mapScenes 
 * @returns 
 */
const analyseComputedPaths = function (computedPaths, mapScenes) {

    computedPaths.forEach((uniquePath) => {
        uniquePath.path.forEach((pathEntry) => {
            pathEntry.thematicsData = [];
            pathEntry.scenes.forEach((scenesEntry) => {
                let currentScenesAccedded = [];
                let currentThemesAccedded = [];
                scenesEntry.forEach((scene) => {
                    if (
                        scene.zonesFound.length > 0 ||
                        pathEntry.category != "chambre_entrainement"
                    ) {
                        const currentTheme = mapScenes.get(scene.name).theme;
                        let themeIndex = pathEntry.thematicsData.findIndex(
                            (e) => e.theme == currentTheme
                        );

                        const alreadyAccedded = currentScenesAccedded.some(
                            (e) => e == scene.name
                        );
                        if (!alreadyAccedded) currentScenesAccedded.push(scene.name);

                        const themeAlreadyAccedded = currentThemesAccedded.some(
                            (e) => e == currentTheme
                        );
                        if (!themeAlreadyAccedded)
                            currentThemesAccedded.push(currentTheme);

                        if (themeIndex == -1) {
                            pathEntry.thematicsData.push({
                                theme: currentTheme,
                                accesDetails: [],
                                occurences: 0,
                                accesses: 0,
                                duration: {
                                    min: 0,
                                    max: 0,
                                },
                            });
                            themeIndex = pathEntry.thematicsData.length - 1;
                        }

                        let nameIndex = pathEntry.thematicsData[
                            themeIndex
                        ].accesDetails.findIndex((e) => e.name == scene.name);

                        if (nameIndex == -1) {
                            pathEntry.thematicsData[themeIndex].accesDetails.push({
                                name: scene.name,
                                occurences: 1,
                                accesses: 1,
                                zonesFoundMin: scene.zonesFound.length,
                                zonesFoundMax: scene.zonesFound.length,
                                zonesFoundTotal: scene.zonesFound.length,
                                zonesFoundMoy: scene.zonesFound.length,
                                zonesScoredMin: scene.zonesScored.length,
                                zonesScoredMax: scene.zonesScored.length,
                                zonesScoredTotal: scene.zonesScored.length,
                                zonesScoredMoy: scene.zonesScored.length,
                            });
                            pathEntry.thematicsData[themeIndex].occurences += 1;
                            pathEntry.thematicsData[themeIndex].duration.min =
                                scene.duration;
                            pathEntry.thematicsData[themeIndex].duration.max =
                                scene.duration;
                            if (!themeAlreadyAccedded)
                                pathEntry.thematicsData[themeIndex].accesses++;
                        } else {
                            pathEntry.thematicsData[themeIndex].accesDetails[nameIndex]
                                .occurences++;
                            if (!alreadyAccedded)
                                pathEntry.thematicsData[themeIndex].accesDetails[nameIndex]
                                    .accesses++;

                            pathEntry.thematicsData[themeIndex].accesDetails[
                                nameIndex
                            ].zonesFoundMin =
                                scene.zonesFound.length <
                                    pathEntry.thematicsData[themeIndex].accesDetails[nameIndex]
                                        .zonesFoundMin
                                    ? scene.zonesFound.length
                                    : pathEntry.thematicsData[themeIndex].accesDetails[
                                        nameIndex
                                    ].zonesFoundMin;
                            pathEntry.thematicsData[themeIndex].accesDetails[
                                nameIndex
                            ].zonesFoundMax =
                                scene.zonesFound.length >
                                    pathEntry.thematicsData[themeIndex].accesDetails[nameIndex]
                                        .zonesFoundMax
                                    ? scene.zonesFound.length
                                    : pathEntry.thematicsData[themeIndex].accesDetails[
                                        nameIndex
                                    ].zonesFoundMax;
                            pathEntry.thematicsData[themeIndex].accesDetails[
                                nameIndex
                            ].zonesFoundTotal += scene.zonesFound.length;
                            pathEntry.thematicsData[themeIndex].accesDetails[
                                nameIndex
                            ].zonesFoundMoy =
                                pathEntry.thematicsData[themeIndex].accesDetails[nameIndex]
                                    .zonesFoundTotal /
                                pathEntry.thematicsData[themeIndex].accesDetails[nameIndex]
                                    .occurences;

                            pathEntry.thematicsData[themeIndex].accesDetails[
                                nameIndex
                            ].zonesScoredMin =
                                scene.zonesScored.length <
                                    pathEntry.thematicsData[themeIndex].accesDetails[nameIndex]
                                        .zonesScoredMin
                                    ? scene.zonesScored.length
                                    : pathEntry.thematicsData[themeIndex].accesDetails[
                                        nameIndex
                                    ].zonesScoredMin;
                            pathEntry.thematicsData[themeIndex].accesDetails[
                                nameIndex
                            ].zonesScoredMax =
                                scene.zonesScored.length >
                                    pathEntry.thematicsData[themeIndex].accesDetails[nameIndex]
                                        .zonesScoredMax
                                    ? scene.zonesScored.length
                                    : pathEntry.thematicsData[themeIndex].accesDetails[
                                        nameIndex
                                    ].zonesScoredMax;
                            pathEntry.thematicsData[themeIndex].accesDetails[
                                nameIndex
                            ].zonesScoredTotal += scene.zonesScored.length;
                            pathEntry.thematicsData[themeIndex].accesDetails[
                                nameIndex
                            ].zonesScoredMoy =
                                pathEntry.thematicsData[themeIndex].accesDetails[nameIndex]
                                    .zonesScoredTotal /
                                pathEntry.thematicsData[themeIndex].accesDetails[nameIndex]
                                    .occurences;

                            pathEntry.thematicsData[themeIndex].occurences++;
                            pathEntry.thematicsData[themeIndex].duration.min =
                                scene.duration <
                                    pathEntry.thematicsData[themeIndex].duration.min
                                    ? scene.duration
                                    : pathEntry.thematicsData[themeIndex].duration.min;
                            pathEntry.thematicsData[themeIndex].duration.max =
                                scene.duration >
                                    pathEntry.thematicsData[themeIndex].duration.max
                                    ? scene.duration
                                    : pathEntry.thematicsData[themeIndex].duration.max;
                            if (!themeAlreadyAccedded)
                                pathEntry.thematicsData[themeIndex].accesses++;
                        }
                    }
                });
            });
        });
    });
    return computedPaths;
}

/**
 * @param {Array} computedPaths
 * @param {Map} mapScenes
 * @returns {Array} result 
 */
const extractScorePerPath = (computedPaths,mapScenes) => {

    const targetCategory='chambre_entrainement';
    let result = [];
    let analysedScenes = [];

    //contract all tag per scene in a scructure
    mapScenes.forEach((value, key)=>{
        if(value.category==targetCategory)analysedScenes.push({id: key, zones: []})
    });
    computedPaths.forEach(compPath => {
        compPath.path.filter(p => p.category==targetCategory).forEach(p => {
            p.scenes.forEach(s => {
                s.forEach(d => {
                    d.zonesFound.forEach(z=>{
                        if(analysedScenes.find(el=> el.id==d.name).zones.findIndex(el=>z.tag==el.tag)==-1){
                            analysedScenes.find(el=> el.id==d.name).zones.push({
                                tag : z.tag,
                                // founded : 0,
                                // scored : 0
                            })
                        }
                    })
                });
            })
        })
    })

    console.log('AnalysedScenes',analysedScenes)

    computedPaths.forEach(compPath => {
        //extract score details per user
        let users = [];
        compPath.path.filter(p => p.category==targetCategory).forEach(p => {
            p.scenes.forEach(s => {
                let actualUser={name : s[0].username, scenes: []};

                s.forEach(d => {

                    actualUser.scenes.push({
                        name: d.name,
                        zonesFound: d.zonesFound,
                        zonesScored: d.zonesScored
                    });
                });

                users.push(actualUser);
            })
        })

        let tmp = []
        analysedScenes.forEach(e=>{
            tmp.push({id : e.id, zones : e.zones.map(e2 => {return {tag:e2.tag, founded:0, scored:0}} )});
        });

        //extract score data relative to the current path
        tmp.forEach(d => {
            users.forEach(u => {
                u.scenes.forEach(s => {
                    if(s.name==d.id){
                        s.zonesFound.forEach(founded => {
                            d.zones.find(el => el.tag==founded.tag).founded++
                        });
                        s.zonesScored.forEach(scored => {
                            d.zones.find(el => el.tag==scored.tag).scored++
                        })
                    }
                })
            })
        })

        result.push({id : compPath.id, users: users, data : tmp})
    })


    console.log('*******Scores Extracted Per Path**********')
    console.log(result)

    return result;
}

/**
 * 
 * @param {Object} files 
 * @param {Boolean} merge_themes 
 * @returns 
 */
const computeData = function (files, merge_themes) {
    let output = {}

    output.general_usage_output = files.general;
    output.detail_usage_output = files.detail;
    output.categories = arrayToMap(files.categories.arrayCategories);
    output.themes = arrayToMap(files.categories.arrayThemes);
    output.scenes = arrayToMap(files.categories.arrayScenes);

    output.detail_usage_output = files["detail"].sort(
        fieldSorterOptimized(["SessionId", "EventTime"])
    );

    //suppressing duplicate data due to an Uptale bug
    //duplicate matches EventTime, EventName and SessionID
    output.detail_usage_output = Object.values(output.detail_usage_output.reduce(
        (accumulator, current) => {
            accumulator[current.SessionId + "|" + JSON.stringify(current.EventTime) + "|" + current.EventName] = current
            return accumulator
        },
        {}
    ));
    //format EventTime to Date format

    

    //sort data by sessionID and Date to ensure events are in correct order

    //remove all events in a session that fires after a Session_Close event
    //due to uptale bug when VR helmet is put in rest mode
    let currentId = undefined;
    let sessionClosed = false;
    output.detail_usage_output = output.detail_usage_output.filter((e) => {
        if (currentId == e.SessionId) {
            if (sessionClosed) {
                return false;
            } else {
                if (e.EventName == "Launch_CloseSession") {
                    sessionClosed = true;
                }
            }
        } else {
            currentId = e.SessionId;
            sessionClosed = false;
        }
        return true;
    });

    output.detail_usage_output.forEach((e) => {
        e.EventTime = new Date(e.EventTime);
    });

    //Get scenes array from csv
    let availableScenes = Object.keys(output.detail_usage_output.reduce((acc, e) => {
        if (e.SceneName) {
            acc[e.SceneName] = true
        }
        return acc
    }, {}))

    //Get scenes array from JSON
    let registeredScenes = files.categories.arrayScenes.reduce((acc, e) => {
        acc.push(e.id)
        return acc
    }, [])
    //get available but not registered scenes
    let missingScenes = availableScenes.filter(x => !registeredScenes.includes(x))
    missingScenes.forEach(e => {
        files.categories.arrayScenes.push({ id: e, category: "defaultCategory", theme: "defaultTheme", whitelisted: true })
    })
    output.scenes = arrayToMap(files.categories.arrayScenes)
    output.themes = arrayToMap(files.categories.arrayThemes);
    output.categories = arrayToMap(files.categories.arrayCategories);

    console.log('computeData : Results')
    console.log(output.detail_usage_output)

    output.paths = setPaths(output.detail_usage_output, output.scenes);
    output.computedPaths = computePaths(output.paths, output.scenes, merge_themes);

    return output
}
/**
 * 
 * @param {Array} paths Organized path data
 * @returns {Array} Array of scenes in which you can find every user and their scores
 */
const perUserScores = function (paths) {

    let results = {};
    paths.forEach((targetSession) => {
        //Une session, toutes les scènes avec des réponses à des QCM
        let QCMScenes = targetSession.scenes.filter(
            (e) => e.zonesFound.length > 0
        );
        QCMScenes.forEach((targetScene) => {
            //Une scène avec des réponses à des QCM, toutes les réponses
            let SceneAnswers = {
                Scene: targetScene.scene,
                User: targetScene.actions[0].LearnerName,
                Mail: targetScene.actions[0].LearnerId,
            };
            let targetAnswers = targetScene.zonesFound;
            targetAnswers.forEach((thisAnswer) => {
                //Une réponse à un QCM
                SceneAnswers["Question : " + thisAnswer.TagName] = thisAnswer.Answer;
            });
            if (!results[SceneAnswers.Scene]) {
                results[SceneAnswers.Scene] = {};
            }
            results[SceneAnswers.Scene][SceneAnswers.User] = SceneAnswers;
        });
    });
    results.allScenesCombined = Object.values(results).reduce((acc, scene) => {
        Object.values(scene).forEach(user => {
            if (!acc[user.User]) {
                acc[user.User] = {}
            }
            delete user.Scene
            acc[user.User] = { ...acc[user.User], ...user }
        })
        return acc
    }, {})

    console.log("perUserScores", results)
    
    return results
}

const qcmPerChamber = detail => {

}




onmessage = (e) => {
    let message = {}
    if (e.data.order == "computeData") {
        message = computeData(e.data.files, e.data.merge_themes);
        message.scorePerPathData = extractScorePerPath(message.computedPaths, message.scenes);
    } else if (e.data.order == "computePaths") {
        message.computedPaths = computePaths(e.data.paths, arrayToMap(e.data.scenes), e.data.merge_themes)
        message.scorePerPathData = extractScorePerPath(message.computedPaths, arrayToMap(e.data.scenes));
    } else if (e.data.order == "perUserScores") {
        message.perUserScores = perUserScores(e.data.paths)
    }
    message.order = e.data.order
    postMessage(message)

}