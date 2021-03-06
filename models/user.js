"use strict";

const db = require("../db");
const bcrypt = require("bcrypt");
const {
  BadRequestError,
  UnauthorizedError,
} = require("../expressError");

const { BCRYPT_WORK_FACTOR } = require("../config.js");
const DEFAULT_IMAGE_URL = "https://cdn.business2community.com/wp-content/uploads/2017/08/blank-profile-picture-973460_640.png";

/** Related functions for users. */

class User {
  /** authenticate user with username, password.
   *
   * Returns { username, first_name, last_name, email, phone }
   *
   * Throws UnauthorizedError is user not found or wrong password.
   **/

  static async authenticate(username, password) {
    // try to find the user first
    const result = await db.query(
          `SELECT username,
                  password,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  phone
           FROM users
           WHERE username = $1`,
        [username],
    );

    const user = result.rows[0];

    if (user) {
      // compare hashed password to a new hash from password
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid === true) {
        delete user.password;
        return user;
      }
    }

    throw new UnauthorizedError("Invalid username/password");
  }

  /** Register user with data.
   *
   * Returns { username, firstName, lastName, email, phone }
   *
   * Throws BadRequestError on duplicates.
   **/

  static async register( username, 
                        password, 
                        firstName, 
                        lastName, 
                        email, 
                        phone ) {
    const duplicateCheck = await db.query(
          `SELECT username
           FROM users
           WHERE username = $1`,
        [username],
    );

    if (duplicateCheck.rows[0]) {
      throw new BadRequestError(`Duplicate username: ${username}`);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

    const result = await db.query(
          `INSERT INTO users
           (username,
            password,
            first_name,
            last_name,
            email,
            phone, 
            image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING username, 
                      first_name AS "firstName", 
                      last_name AS "lastName", 
                      email, 
                      phone`,
        [
          username,
          hashedPassword,
          firstName,
          lastName,
          email,
          phone,
          DEFAULT_IMAGE_URL
        ],
    );

    const user = result.rows[0];

    return user;
  }

  /** If user provided image file on signup, update
   * image_url in DB to url of image stored in S3
   */
  static async updateUserImgUrl( imageUrl, username ) {
       await db.query(
      `UPDATE users 
        SET image_url = $1
        WHERE username = $2`, 
        [imageUrl, username]
    );

  }

  /** Get user by username */
  static async getUser(username) {
    const result = await db.query(
          `SELECT username,
                  password,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  phone
           FROM users
           WHERE username = $1`,
        [username],
    );

    const user = result.rows[0];

    if (user) {
      return { user }
    }
  }

}

module.exports = User;
