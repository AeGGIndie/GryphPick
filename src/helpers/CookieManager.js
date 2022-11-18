const puppeteer = require("puppeteer-extra");
const { executablePath } = require("puppeteer");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
const UserAgent = require("user-agents");
const _ = require("lodash");
const { webadvisor } = require("../config");
const config = require("../config");

// configuring puppeteer
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

class CookieManager {
  constructor() {
    this.browser = null;
    this.page = null;
    this.cookie = null;
    this.requestVerificationToken = null;
    this.browserOptions = {
      // handleSIGHUP: false,
      handleSIGINT: false, // manually handle
      // handleSIGTERM: false, // same with above
      args: ["--window-size=1920,1080"],
      headless: process.env.NODE_ENV === "PROD",
      executablePath: executablePath(),
      // ignoreDefaultArgs: ['--disable-extensions'],
    }
  }

  // getter
  getCookie() {
    return this.cookie;
  }

  // setter
  setCookie(cookie) {
    this.cookie = cookie;
  }

  getPage() {
    return this.page;
  }

  getRequestVerificationToken() {
    return this.requestVerificationToken;
  }

  /**
   * Mainly used for debugging and developing, hence the long wait time
   */
  async open() {
    try {
      this.browser = await puppeteer.launch(this.browserOptions);
      this.page = await this.browser.newPage();
      // this.page.waitForTimeout(300 * 1000);
    } catch (err) {
      throw new Error(err);
    }
  }

  async fetchCookie() {
    try {
      // create a new browser
      this.browser = await puppeteer.launch(this.browserOptions);

      // go to the login page from webadvisor
      this.page = await this.browser.newPage();
      await this.page.setDefaultNavigationTimeout(0);
      await this.page.setUserAgent(new UserAgent().toString());
      await this.page.goto(webadvisor.register);

      // wait until login has been loaded on screen
      await this.page.waitForSelector(".form-horizontal");
      await this.page.type("#inputUsername", config.username);
      await this.page.type("#inputPassword", config.password);
      await this.page.click('button[type="submit"]');
      await this.page.waitForNavigation({
        waitUntil: "networkidle0",
      });

      // get the cookies once we've logged in, joining all of them into a string
      this.setCookie(
        _.join(
          _.map(await this.page.cookies(), ({ name, value }) =>
            _.join([name, value], "=")
          ),
          "; "
        )
      );

      const requestVerificationToken = _.filter(
        await this.page.cookies(),
        ({ name, value }) => {
          console.log(name, value);
          if (name === "__RequestVerificationToken_L1N0dWRlbnQ1") {
            return true;
          }
          return false;
        }
      );
      this.requestVerificationToken =
        requestVerificationToken.length != 0
          ? requestVerificationToken[0]
          : null;
      return this.cookie;
    } catch (err) {
      throw new Error(err);
    }
  }

  async logout() {
    // close page and browser instances
    this.page &&
      this.cookie &&
      (await this.page.goto(
        webadvisor.logout
      )) &&
      (await this.page.waitForNavigation({
        waitUntil: "networkidle2",
      }));
    await this.page.waitForTimeout(2000);
    // this.page && this.cookie && (await this.page.click("#logOff")); // log off
    this.page && (await this.page.close());
    this.browser && (await this.browser.close());
  }
}

module.exports = CookieManager;
