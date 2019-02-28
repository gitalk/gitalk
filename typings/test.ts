import Gitalk from ".";

const options: Gitalk.GitalkOptions = {
    clientID: "id",
    clientSecret: "secret",
    repo: "repo",
    owner: "owner",
    admin: ["admin"],
    language: "language",
    id: "id",
    distractionFreeMode: false,
};

const allOptions: Gitalk.GitalkOptions = {
    clientID: "id",
    clientSecret: "secret",
    repo: "repo",
    owner: "owner",
    admin: ["admin"],
    id: "id",
    number: -1,
    labels: ["Gitalk"],
    title: "title",
    body: "body",
    language: "language",
    perPage: 123,
    distractionFreeMode: false,
    pagerDirection: "first",
    createIssueManually: false,
    proxy: "123",
    flipMoveOptions: {
        staggerDelayBy: 150,
    },
    enableHotKey: false,
};

const instance = new Gitalk(options);
instance.render("#element");
