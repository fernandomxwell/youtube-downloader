exports.transform = data => {
    return data
        .array()
        .map(item => {
            return {
                key: item.param,
                message: item.msg,
            };
        });
};