/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */

// const OpenAI = require("openai");
const axios = require("axios");
const result = require("./data");

module.exports = (app) => {
  app.on(
    ["pull_request.opened", "pull_request.reopened", "pull_request.edited"],
    async (context) => {
      const repoName = context.payload.repository.name;
      const repoOwner = context.payload.repository.owner.login;
      const pullNumber = context.payload.number;

      const files = await context.octokit.pulls.listFiles({
        repo: repoName,
        owner: repoOwner,
        pull_number: pullNumber,
      });

      if (!files || files.data.length === 0) {
        context.log.warn("No files found in the pull request.");
        return;
      }

      for (const file of files.data) {
        const fileContent = await context.octokit.repos.getContent({
          repo: repoName,
          owner: repoOwner,
          path: file.filename,
          ref: context.payload.pull_request.head.sha,
        });

        const codeChanges = Buffer.from(
          fileContent.data.content,
          "base64"
        ).toString("utf-8");

        if (
          context.payload.pull_request.body !== null &&
          context.payload.pull_request.body.includes("/explain")
        ) {
          const explanation = await getExplanation(codeChanges);

          context.octokit.issues.createComment({
            repo: repoName,
            owner: repoOwner,
            issue_number: pullNumber,
            body: `################################ Explanation for changes in **${file.filename}** #################################\n\n${explanation}\n`,
          });
        }

        if (
          context.payload.pull_request.body !== null &&
          context.payload.pull_request.body.includes("/execute")
        ) {
          const output = await getOutput(codeChanges, file.filename);

          if (output && output.length > 0) {
            context.octokit.issues.createComment({
              repo: repoName,
              owner: repoOwner,
              issue_number: pullNumber,
              body: `################################## Output for changes in **${file.filename}** ##################################\n\n${output}\n`,
            });
          }
        }
      }
    }
  );

  app.on(["pull_request_review_comment"], async (context) => {
    const repoName = context.payload.repository.name;
    const repoOwner = context.payload.repository.owner.login;
    const pullNumber = context.payload.pull_request.number;
    const comment = context.payload.comment.body;

    const files = await context.octokit.pulls.listFiles({
      repo: repoName,
      owner: repoOwner,
      pull_number: pullNumber,
    });

    if (!files || files.data.length === 0) {
      context.log.warn("No files found in the pull request.");
      return;
    }

    for (const file of files.data) {
      const fileContent = await context.octokit.repos.getContent({
        repo: repoName,
        owner: repoOwner,
        path: file.filename,
        ref: context.payload.pull_request.head.sha,
      });

      const codeChanges = Buffer.from(
        fileContent.data.content,
        "base64"
      ).toString("utf-8");

      if (
        comment !== null &&
        comment.includes("/explain") &&
        file.filename === context.payload.comment.path
      ) {
        const explanation = await getExplanation(codeChanges);

        context.octokit.rest.pulls.createReviewComment({
          repo: repoName,
          owner: repoOwner,
          pull_number: pullNumber,
          body: `########## Explanation for changes in ${file.filename} ###########\n\n${explanation}\n`,
          commit_id: context.payload.comment.commit_id,
          path: context.payload.comment.path,
          position: context.payload.comment.position,
        });
      }

      if (
        comment !== null &&
        comment.includes("/execute") &&
        file.filename === context.payload.comment.path
      ) {
        const output = await getOutput(codeChanges, file.filename);

        if (output && output.length > 0) {
          context.octokit.rest.pulls.createReviewComment({
            repo: repoName,
            owner: repoOwner,
            pull_number: pullNumber,
            body: `############ Output for changes in ${file.filename} #############\n\n${output}\n`,
            commit_id: context.payload.comment.commit_id,
            path: context.payload.comment.path,
            position: context.payload.comment.position,
          });
        }
      }
    }
  });

  async function getOutput(code, filename) {
    try {
      const filetype = filename.split(".").pop();
      const version = result[filetype];

      const output = await axios.post(
        "https://emkc.org/api/v2/piston/execute",
        {
          language: filetype,
          version: version,
          files: [
            {
              content: code,
            },
          ],
        }
      );

      return output.data.run.output;
    } catch (err) {
      console.log(err);
    }
  }

  async function getExplanation(code) {
    try {
      // return "yolo";
      const data = {
        model: "pai-001-light-beta",
        prompt: `Explain this code to me:\n' + ${code} + '\n\n`,
        temperature: 0.7,
        max_tokens: 256,
        stop: ["Human:", "AI:"],
      };

      const headers = {
        Authorization: `Bearer ${process.env.FREE_LLM}`,
        "Content-Type": "application/json",
      };

      const response = await axios.post(
        "https://api.pawan.krd/v1/completions",
        data,
        { headers }
      );

      return response.data.choices[0].text;
    } catch (err) {
      console.error(err);
    }
  }

  //GPT API IF AVIALABLE
  // async function getExplanation(code){
  //   try{
  //     const myopenai = new OpenAI(process.env.OPENAI_API_KEY);
  //     const response = await myopenai.chat.completions.create({
  //       model: "gpt-3.5-turbo",
  //       messages: [{"role": "system", "content": `Explain me this code ${code}`},],
  //     });
  //     console.log(response);
  //     return response.data.choices[0].text;
  //   }
  //   catch(err){
  //     console.log(err)
  //   }
  // }
};
