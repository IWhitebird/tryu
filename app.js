/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */

// Import necessary modules
// const OpenAI = require("openai"); // If you plan to use the OpenAI API
const axios = require("axios");
const result = require("./data");

// Export the Probot app function
module.exports = (app) => {
  // Log a message when the Probot app starts
  app.log("PROBOT WEBHOOK");

  // Define event listeners for pull requests
  app.on(
    ["pull_request.opened", "pull_request.reopened", "pull_request.edited"],
    async (context) => {
      // Extract information about the pull request
      const repoName = context.payload.repository.name;
      const repoOwner = context.payload.repository.owner.login;
      const pullNumber = context.payload.number;

      // Get the list of files in the pull request
      const files = await context.octokit.pulls.listFiles({
        repo: repoName,
        owner: repoOwner,
        pull_number: pullNumber,
      });

      // Check if there are any files in the pull request
      if (!files || files.data.length === 0) {
        context.log.warn("No files found in the pull request.");
        return;
      }

      // Iterate through the files in the pull request
      for (const file of files.data) {
        // Get the content of the file
        const fileContent = await context.octokit.repos.getContent({
          repo: repoName,
          owner: repoOwner,
          path: file.filename,
          ref: context.payload.pull_request.head.sha,
        });

        // Convert the file content from base64 to UTF-8
        const codeChanges = Buffer.from(
          fileContent.data.content,
          "base64"
        ).toString("utf-8");

        // Check if the pull request body includes "/explain"
        if (
          context.payload.pull_request.body !== null &&
          context.payload.pull_request.body.includes("/explain")
        ) {
          // Get an explanation for the code changes
          const explanation = await getExplanation(codeChanges);

          // Create a comment with the explanation
          context.octokit.issues.createComment({
            repo: repoName,
            owner: repoOwner,
            issue_number: pullNumber,
            body: `################################ Explanation for changes in **${file.filename}** #################################\n\n${explanation}\n`,
          });
        }

        // Check if the pull request body includes "/execute"
        if (
          context.payload.pull_request.body !== null &&
          context.payload.pull_request.body.includes("/execute")
        ) {
          // Get the output of executing the code changes
          const output = await getOutput(codeChanges, file.filename);

          // If there is output, create a comment with the output
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

  // Define event listener for pull request review comments
  app.on(["pull_request_review_comment"], async (context) => {
    // Extract information about the pull request and comment
    const repoName = context.payload.repository.name;
    const repoOwner = context.payload.repository.owner.login;
    const pullNumber = context.payload.pull_request.number;
    const comment = context.payload.comment.body;

    // Get the list of files in the pull request
    const files = await context.octokit.pulls.listFiles({
      repo: repoName,
      owner: repoOwner,
      pull_number: pullNumber,
    });

    // Check if there are any files in the pull request
    if (!files || files.data.length === 0) {
      context.log.warn("No files found in the pull request.");
      return;
    }

    // Iterate through the files in the pull request
    for (const file of files.data) {
      // Get the content of the file
      const fileContent = await context.octokit.repos.getContent({
        repo: repoName,
        owner: repoOwner,
        path: file.filename,
        ref: context.payload.pull_request.head.sha,
      });

      // Convert the file content from base64 to UTF-8
      const codeChanges = Buffer.from(
        fileContent.data.content,
        "base64"
      ).toString("utf-8");

      // Check if the comment includes "/explain" and the file matches
      if (
        comment !== null &&
        comment.includes("/explain") &&
        file.filename === context.payload.comment.path
      ) {
        // Get an explanation for the code changes
        const explanation = await getExplanation(codeChanges);

        // Create a review comment with the explanation
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

      // Check if the comment includes "/execute" and the file matches
      if (
        comment !== null &&
        comment.includes("/execute") &&
        file.filename === context.payload.comment.path
      ) {
        // Get the output of executing the code changes
        const output = await getOutput(codeChanges, file.filename);

        // If there is output, create a review comment with the output
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

  // Function to get the output of executing code
  async function getOutput(code, filename) {
    try {
      // Extract the file type and version from the result object
      const filetype = filename.split(".").pop();
      const version = result[filetype];

      // Execute the code using an external API (emkc.org)
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

  // Function to get an explanation for code
  async function getExplanation(code) {
    try {
      // Define data and headers for the explanation request
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

      // Send a request to an external API (api.pawan.krd)
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

  // Uncomment this section if you plan to use the OpenAI API for explanation
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
