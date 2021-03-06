const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");
const keys = require("../../config/keys");
const passport = require("passport");
const validateRegisterInput = require("../../validation/register");
const validateLoginInput = require("../../validation/login");
const pointSchema = require("../../models/pointSchema");

const router = express.Router();
router.get("/test", (req, res) => res.json({ msg: "This is the users route" }));

router.post("/register", (req, res) => {
	const { errors, isValid } = validateRegisterInput(req.body);

	if (!isValid) {
		return res.status(400).json(errors);
	}

	//confirm we don't already have this email
	User.findOne({ email: req.body.email }).then(user => {
		if (user) {
			return res.status(400).json({
				email: "A user has already registered with this address",
			});
		} else {
			
			const newUser = new User({
				firstName: req.body.firstName,
				lastName: req.body.lastName,
				email: req.body.email,
				password: req.body.password,
				location: req.body.location, 
				
				/*Expected format is geoJSON:
				
				req.body.location = 
					{ type: 'Point', coordinates: [-104.9903, 39.7392] };
				
					Note: coordinates[longitude, latitude]
				 */
			});

			bcrypt.genSalt(10, (err, salt) => {
				bcrypt.hash(newUser.password, salt, (err, hash) => {
					if (err) throw err;
					newUser.password = hash;
					newUser
						.save()
						.then(user => {
							const payload = {
								id: user.id,
								handle: user.handle,
							};

							jwt.sign(
								payload,
								keys.secretOrKey,
								{ expiresIn: 3600 },
								(err, token) => {
									res.json({
										success: true,
										token: "Bearer " + token,
									});
								}
							);
						})
						.catch(err => console.log(err));
				});
			});
		}
	});
});

router.post("/login", (req, res) => {
	const email = req.body.email;
	const password = req.body.password;

	const { errors, isValid } = validateLoginInput(req.body);

	if (!isValid) {
		return res.status(400).json(errors);
	}

	User.findOne({ email }).then(user => {
		if (!user) {
			return res.status(404).json({ email: "This user does not exist" });
		}

		bcrypt.compare(password, user.password).then(isMatch => {
			if (isMatch) {
				const payload = { id: user.id, handle: user.handle };

				jwt.sign(
					payload,
					keys.secretOrKey,
					{ expiresIn: 3600 }, // Tell the key to expire in one hour
					(err, token) => {
						res.json({
							success: true,
							token: "Bearer " + token,
						});
					}
				);
			} else {
				return res.status(400).json({ password: "Incorrect password" });
			}
		});
	});
});

//Protected route
router.get(
	"/current",
	passport.authenticate("jwt", { session: false }),
	(req, res) => {
		res.json({
			id: req.user.id,
			handle: req.user.handle,
			email: req.user.email,
		});
	}
);

module.exports = router;
