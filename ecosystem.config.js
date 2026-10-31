module.exports = {
  apps: [
    {
      name: "diary", // must match the folder name in /srv/apps
      script: "server/index.js",
      instances: 1,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3101,
      },
    },
  ],
};
