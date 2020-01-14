'use strict';

module.exports = {
    transformer,
};

function transformer({data}) {
    data = refactorGeoShape({data});
    data = remapContributors({data});
    return data;
}

function refactorGeoShape({data}) {
    if (!data.contentLocation) return data;
    let shape = data.contentLocation.geo.box;
    let coordinates = [
        shape.split(' ')[0].split(','),
        shape.split(' ')[1].split(','),
    ];
    data.contentLocation = {
        type: 'envelope',
        coordinates,
    };
    return data;
}

function remapContributors({data}) {
    data.contributor = data.contributor.map(c => {
        return {
            role: c.name,
            name: c.contributor.name,
        };
    });
    return data;
}
