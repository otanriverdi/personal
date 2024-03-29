module.exports = {
  siteMetadata: {
    title: `Özgür Tanrıverdi`,
    author: {
      name: `Özgür Tanrıverdi`,
      summary: `a software developer and a serial learner with a love to develop software people can't stop talking about. I am also the dev #5939 on the Developer_DAO!`,
    },
    description: `Hi! I'm Özgür Tanrıverdi. A software developer and a serial learner with a love to develop software people can't stop talking about.`,
    siteUrl: `https://otrv.dev`,
    social: {
      twitter: `otrv45`,
      github: 'otanriverdi',
      linkedin: 'otrv',
    },
  },
  plugins: [
    `gatsby-plugin-advanced-sitemap`,
    {
      resolve: `gatsby-plugin-canonical-urls`,
      options: {
        siteUrl: `https://otrv.dev`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        path: `${__dirname}/content/blog`,
        name: `blog`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        path: `${__dirname}/content/assets`,
        name: `assets`,
      },
    },
    {
      resolve: `gatsby-transformer-remark`,
      options: {
        plugins: [
          {
            resolve: `gatsby-remark-images`,
            options: {
              maxWidth: 630,
            },
          },
          {
            resolve: `gatsby-remark-responsive-iframe`,
            options: {
              wrapperStyle: `margin-bottom: 1.0725rem`,
            },
          },
          `gatsby-remark-prismjs`,
          `gatsby-remark-copy-linked-files`,
          `gatsby-remark-smartypants`,
        ],
      },
    },
    `gatsby-transformer-sharp`,
    `gatsby-plugin-sharp`,
    {
      resolve: `gatsby-plugin-google-analytics`,
      options: {
        trackingId: `UA-168002211-1`,
      },
    },
    `gatsby-plugin-feed`,
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `Ozgur Tanriverdi`,
        short_name: `OTRV`,
        start_url: `/`,
        background_color: `#eff0f3`,
        theme_color: `#ff8e3c`,
        display: `minimal-ui`,
        icon: `content/assets/gatsby-icon.png`,
      },
    },
    `gatsby-plugin-react-helmet`,
  ],
};
