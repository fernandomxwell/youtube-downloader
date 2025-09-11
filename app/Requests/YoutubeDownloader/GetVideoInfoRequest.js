/**
 * ==============================
 * Form Request Validation
 * ==============================
 * 
 * This is a validation layer that sits between your request's data (input)
 * and the controller that are consume the request's data.
 * 
 * Each form request generated has one attribute `rules`
 * that returns the validation rules that should apply to request's data
 * and one method `validate` that responsible for determining
 * if the request's data is valid or not.
 * 
 * ValidationChain > https://express-validator.github.io/docs/api/validation-chain
 */

const { check, validationResult } = require('express-validator');
const ytdl = require('ytdl-core');

exports.rules = [
    check('url')
        .notEmpty()
        .trim()
        .isURL(),
];

exports.validate = async (req, res, next) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.error(res.__('errors.422'), 422, errors.array());
        }

        if (!ytdl.validateURL(req.body.url)) {
            return res.error(res.__('errors.400.invalid', {
                name: 'Youtube URL',
            }), 400);
        }

        next();
    } catch (error) {
        return res.defaultError(error.stack);
    }
};