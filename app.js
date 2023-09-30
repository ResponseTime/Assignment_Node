require("dotenv").config();
const express = require("express");
const app = express();
const port = 3000;
const axios = require("axios");
const _ = require("lodash");

//memoized caching implementation
const memoizedFetch = _.memoize(
  async () => {
    try {
      const options = {
        headers: {
          "x-hasura-admin-secret": process.env.ADMIN_SECRET,
        },
      };
      const data = await axios.get(
        "https://intent-kit-16.hasura.app/api/rest/blogs",
        options
      );
      return data.data;
    } catch (err) {
      throw err;
    }
  },
  () => "data",
  { maxAge: 10 * 60 * 1000 }
);
//memoized searching implementation
const memoizedSearch = _.memoize(
  (data, query) => {
    const result = data.blogs.filter((x) =>
      x.title
        .split(" ")
        .map((x) => x.toLowerCase())
        .includes(query)
    );
    return result;
  },
  (data, query) => `search_${query}`,
  { maxAge: 10 * 60 * 1000 }
);
//normal middleware
const middleware = async (req, res, next) => {
  try {
    const options = {
      headers: {
        "x-hasura-admin-secret": process.env.ADMIN_SECRET,
      },
    };
    const data = await axios.get(
      "https://intent-kit-16.hasura.app/api/rest/blogs",
      options
    );
    req.data = data.data;
  } catch (err) {
    res.status(401).json({ err: err.message });
  }
  next();
};

//memoized middleware
const middleware2 = async (req, res, next) => {
  try {
    const data = await memoizedFetch();
    req.data = data;
  } catch (err) {
    res.status(401).json({ err: err.message });
  }
  next();
};
app.use(middleware2);
// app.use(middleware);

app.get("/api/blog-stats", (req, res) => {
  if (!req.data || !req.data.blogs || !Array.isArray(req.data.blogs)) {
    return res.status(400).json({ error: "Invalid data structure" });
  }
  const total = _.size(req.data.blogs);
  const longestTitleBlog = _.maxBy(req.data.blogs, "title.length");
  const filter = req.data.blogs.filter((x) =>
    x.title.toLowerCase().startsWith("privacy")
  );
  const unique = _.uniqWith(
    req.data.blogs,
    (blogA, blogB) => blogA.title.toLowerCase() === blogB.title.toLowerCase()
  ).map((blog) => blog.title);
  result = {
    "Total number of blogs": total,
    "The title of the longest blog": longestTitleBlog,
    "Number of blogs with 'privacy' in the title": filter.length,
    "An array of unique blog titles": unique,
  };
  res.json(result);
});
//normal search without caching
// app.get("/api/blog-search", (req, res) => {
//   const query = req.query.query;
//   const result = req.data.blogs.filter((x) =>
//     x.title
//       .split(" ")
//       .map((x) => x.toLowerCase())
//       .includes(query)
//   );
//   res.json(result);
// });

//memoized search route
app.get("/api/blog-search", (req, res) => {
  const query = req.query.query;
  try {
    const searchResult = memoizedSearch(req.data, query);
    res.json(searchResult);
  } catch (err) {
    res.status(500).json({ error: "Error fetching search results." });
  }
});
app.listen(port, () => {
  console.log("running");
});
