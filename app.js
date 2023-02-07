const http = require("http");
const discord = require("discord.js");
const axios = require("axios");
const ejs = require("ejs");
const url = require("url");
const config = require("./config.json");
const express = require("express");
const passport = require("passport");
const bodyParser = require("body-parser");
const session = require("express-session");
const Strategy = require("passport-discord").Strategy;
const app = express();
const MemoryStore = require("memorystore")(session);
const server = http.createServer(app);
const stripe = require("stripe")(process.env.STRIPE_KEY);
const User = require("./models/User");
const { webhook } = require("./webhook");
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.static("public"));
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

let domain = config.domain;
let callbackUrl = config.redirectURL;
const domainUrl = new URL(config.domain);

passport.use(
  new Strategy(
    {
      clientID: config.Id,
      clientSecret: config.Secret,
      callbackURL: config.redirectURL,
      scope: ["identify", "email"],
    },
    (accessToken, refreshToken, profile, done) => {
      process.nextTick(() => done(null, profile));
    }
  )
);

app.use(
  session({
    store: new MemoryStore({ checkPeriod: 86400000 }),
    secret:
      "A^^rW=V%Y;)tJHh_WG/q/a,5:TL#jdDyP5&9;Mc&RAJOP322440EWDKFSjfejfijdiiw929ee923ie9diidsid9d999",
    resave: false,
    saveUninitialized: false,
  })
);

// We initialize passport middleware.
app.use(passport.initialize());
app.use(passport.session());

// We bind the domain.
app.locals.domain = config.domain.split("//")[1];

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

const checkAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  req.session.backURL = req.url;
  // We redirect user to login endpoint/route.
  res.redirect("/login");
};

// Login endpoint.
app.get(
  "/login",
  (req, res, next) => {
    // We determine the returning url.
    if (req.session.backURL) {
      req.session.backURL = req.session.backURL;
    } else if (req.headers.referer) {
      const parsed = url.parse(req.headers.referer);
      if (parsed.hostname === app.locals.domain) {
        req.session.backURL = parsed.path;
      }
    } else {
      req.session.backURL = "/";
    }
    // Forward the request to the passport middleware.
    next();
  },
  passport.authenticate("discord")
);

// Callback endpoint.
app.get(
  "/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  async (req, res) => {
    // If user had set a returning url, we redirect him there, otherwise we redirect him to index.
    if (req.session.backURL) {
      const backURL = req.session.backURL;
      req.session.backURL = null;
      res.redirect(backURL);
    } else {
      res.redirect("/");
    }

    let user = await User.findOne({ userID: req.user.id });
    if (!user) {
      user = User.create({ userID: req.user.id });
    }
  }
);

app.get("/logout", function (req, res) {
  req.session.destroy(() => {
    req.logout();
    res.redirect("/");
  });
});

app.get("/", function (req, res) {
  res.render("index", { user: req.user });
});

app.get("/invite", async (req, res) => {
  res.redirect(config.invite);
});
app.get("/support", async (req, res) => {
  res.redirect(config.support);
});
app.get("/discord", async (req, res) => {
  res.redirect(config.support);
});

app.get("/github", async (req, res) => {
  res.redirect(config.github);
});

app.get("/premium", async (req, res) => {
  res.redirect(config.patreon)
});

app.get("/guide", checkAuth, async (req, res) => {
  res.render("guide", { user: req.user });
});

app.get("/cancel", checkAuth, async (req, res) => {
  res.render("cancel", { user: req.user });
});

app.get("/privacy", async (req, res) => {
  res.render("privacy", { user: req.user });
});
app.get("/terms", async (req, res) => {
  res.render("terms", { user: req.user });
});

async function createCustomer(req) {
  let user =
    (await User.findOne({ userID: req.id })) || new User({ userID: req.id });

  if (user.customerId) {
    return user.customerId;
  } else {
    const customer = await stripe.customers.create({
      email: req.email,
      name: req.username,
      metadata: {
        id: req.id,
        email: req.email,
      },
    });
    user.customerId = customer.id;
    user.email = req.email;
    await user.save();

    return user.customerId;
  }
}


app.post('/create-customer-portal-session', checkAuth, async (req, res) => {

  const customer = await createCustomer(req.user)

  const session = await stripe.billingPortal.sessions.create({
    customer: `${customer}`,
    return_url: `${config.domain}premium`,
  });

  res.redirect(session.url);

})



app.post("/gold-plan", checkAuth, async (req, res) => {
  const customer = await createCustomer(req.user);

  const session = await stripe.checkout.sessions.create({
    customer,
    payment_method_types: ["card"],
    mode: "subscription",
    billing_address_collection: "auto",
    line_items: [
      {
        price: config.plans.gold,
        quantity: 1,
      },
    ],
    metadata: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      type: "gold",
    },

    success_url: `${config.domain}guide`,
    cancel_url: `${config.domain}cancel`,
  });
  return res.redirect(303, session.url);
});

app.post("/platinum-plan", checkAuth, async (req, res) => {
  const customer = await createCustomer(req.user);

  const session = await stripe.checkout.sessions.create({
    customer,
    payment_method_types: ["card"],
    mode: "subscription",
    billing_address_collection: "auto",
    line_items: [
      {
        price: config.plans.platinum,
        quantity: 1,
      },
    ],
    metadata: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      type: "gold",
    },

    success_url: `${config.domain}guide`,
    cancel_url: `${config.domain}cancel`,
  });
  return res.redirect(303, session.url);
});

app.post("/daimond-plan", checkAuth, async (req, res) => {
  const customer = await createCustomer(req.user);

  const session = await stripe.checkout.sessions.create({
    customer,
    payment_method_types: ["card"],
    mode: "subscription",
    billing_address_collection: "auto",
    line_items: [
      {
        price: config.plans.daimond,
        quantity: 1,
      },
    ],
    metadata: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      type: "diamond",
    },

    success_url: `${config.domain}guide`,
    cancel_url: `${config.domain}cancel`,
  });
  return res.redirect(303, session.url);
});

app.post("/custom-plan", checkAuth, async (req, res) => {
  const customer = await createCustomer(req.user);

  const session = await stripe.checkout.sessions.create({
    customer,
    payment_method_types: ["card"],
    mode: "subscription",
    billing_address_collection: "auto",
    line_items: [
      {
        price: config.plans.custom,
        quantity: 1,
      },
    ],
    metadata: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      type: "custom",
    },

    success_url: `${config.domain}guide`,
    cancel_url: `${config.domain}cancel`,
  });
  return res.redirect(303, session.url);
});

async function checkoutCompleted(event) {
  let data = event.data.object.metadata;

  if (data.type === "gold") {
    let user = await User.findOne({ userID: data.id });

    user.premium.subscriptionType.server = true;
    user.premium.subscription = 399;
    user.premium.servers.totalGuilds += 1;
    user.premium.expiryTimestamp = new Date(
      new Date().getTime() + 30 * 24 * 60 * 60 * 1000
    ).getTime();
    user.premium.servers.redeemedGuilds = [];
    await user.save();

    webhook(
      `[+] Premium Purchase`,
      `**User:** \`${data.username} (ID: ${user.userID})\`\n**Plan:** \`Moosic Gold Tier\`\n **Price:** \`$3.99\` `
    );
  } else if (data.type === "platinum") {
    let user = await User.findOne({ userID: data.id });

    user.premium.subscriptionType.server = true;
    user.premium.subscription = 599;
    user.premium.servers.totalGuilds += 3;
    user.premium.expiryTimestamp = new Date(
      new Date().getTime() + 30 * 24 * 60 * 60 * 1000
    ).getTime();
    user.premium.servers.redeemedGuilds = [];
    await user.save();

    webhook(
      `[+] Premium Purchase`,
      `**User:** \`${data.username} (ID: ${user.userID})\`\n**Plan:** \`Moosic Platinum Tier\`\n **Price:** \`$5.99\` `
    );
  } else if (data.type === "diamond") {
    let user = await User.findOne({ userID: data.id });

    user.premium.subscriptionType.server = true;
    user.premium.subscription = 999;
    user.premium.servers.totalGuilds += 7;
    user.premium.expiryTimestamp = new Date(
      new Date().getTime() + 30 * 24 * 60 * 60 * 1000
    ).getTime();
    user.premium.servers.redeemedGuilds = [];
    await user.save();
    webhook(
      `[+] Premium Purchase`,
      `**User:** \`${data.username} (ID: ${user.userID})\`\n**Plan:** \`Moosic Diamond Tier\`\n **Price:** \`$9.99\` `
    );
  } else if (data.type === "custom") {
    let user = await User.findOne({ userID: data.id });

    user.premium.subscriptionType.custom = true;
    user.premium.subscription = 2499;
    user.premium.expiryTimestamp = new Date(
      new Date().getTime() + 30 * 24 * 60 * 60 * 1000
    ).getTime();
    await user.save();

    webhook(
      `[+] Premium Purchase`,
      `**User:** \`${data.username} (ID: ${user.userID})\`\n**Plan:** \`Custom Moosic\`\n **Price:** \`$24.99\` `
    );
  }
}

async function invoicePaid(event) {
  let data = event.data.object.customer_email,
    type = event.data.object.lines.data[0].price.id,
    user = await User.findOne({ email: data });

  if (type == config.plans.gold) {
    user.premium.subscriptionType.server = true;
    user.premium.subscription = 399;
    user.premium.expiryTimestamp = new Date(
      new Date().getTime() + 30 * 24 * 60 * 60 * 1000
    ).getTime();
    await user.save();
  } else if (type == config.plans.platinum) {
    user.premium.subscriptionType.server = true;
    user.premium.subscription = 599;
    user.premium.expiryTimestamp = new Date(
      new Date().getTime() + 30 * 24 * 60 * 60 * 1000
    ).getTime();
    await user.save();
  } else if (type == config.plans.daimond) {
    user.premium.subscriptionType.server = true;
    user.premium.subscription = 999;
    user.premium.expiryTimestamp = new Date(
      new Date().getTime() + 30 * 24 * 60 * 60 * 1000
    ).getTime();
    await user.save();
  } else if (type == config.plans.custom) {
    user.premium.subscriptionType.custom = true;
    user.premium.subscription = 2499;
    user.premium.expiryTimestamp = new Date(
      new Date().getTime() + 30 * 24 * 60 * 60 * 1000
    ).getTime();
    await user.save();
  }
}

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const payload = JSON.stringify(req.body, null, 2);
    //  const sig = req.headers['stripe-signature']

    let event;

    const secret = config.webhook;

    const header = stripe.webhooks.generateTestHeaderString({
      payload: payload,
      secret,
    });

    event = stripe.webhooks.constructEvent(payload, header, secret);

    // console.log(event)
    switch (event.type) {
      case "checkout.session.completed": {
        await checkoutCompleted(event);
        break;
      }
      case "invoice.paid": {
        await invoicePaid(event);
        break;
      }
    }
  }
);

app.get("/*", (req, res) => {
  res.redirect("/");
});

const listener = server.listen(process.env.PORT || 3000, function () {
  console.log(`Your app is listening on port ${process.env.PORT}`);
});
