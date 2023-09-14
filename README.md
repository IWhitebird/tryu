# TryU: Pr helper
 GithubApp made with Probot for Executing and Explanation of a Pull Request.
 I used free API from discord "Pawan.krd" for LLM and used PISTON API for executing the code.
 I need to run the bot locally for it to work, I also deployed webhook on Vercel but FREE LLM API has restricted IP 
 and I dont have GPT API 
 
 ## Clone this repo
  Clone this repo then just run this commands
  
  -> `npm install`
  
  -> `npm start`
 ## Use Docker
  My Docker Hub repo `https://hub.docker.com/r/iwhitebird/tryu-github-app/tags`
 
  `docker pull iwhitebird/tryu-github-app:latest`
  
  `docker run -d -p 3000:3000 --name TryU iwhitebird/tryu-github-app:latest`

*Note : Current /explain will not work as the free api locks the Ip address of first call*

 ## Result & Deployment

You can add **/explain** and **/execute** in the description while creating a pr and TryU-bot will automatically generate an explanation and execution(only if the code gives some output)

https://github.com/IWhitebird/tryu/assets/115157819/6c106867-b534-46b5-a8d9-aaafbe45bcd0

You can also comment a specific file with both **/explain** and **/execute** for the respective task.

https://github.com/IWhitebird/tryu/assets/115157819/3a38127e-d464-4bf0-b49f-f280e1cd43e0


   <video alt="tryuvideo1" src="https://github.com/IWhitebird/tryu/assets/TryUApp1.mp4" width="276" height="537" />
       
  The probot webhook is deployed on vercel.

 
    

