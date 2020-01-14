'use strict';

module.exports = {
    transformer,
};

function transformer({data}) {
    data = refactorGeoShape({data});
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
