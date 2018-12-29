FROM node
RUN mkdir -p /home/dipnet
WORKDIR /home/dipnet
COPY . /home/dipnet
RUN npm install
RUN npm install pm2 -g
CMD pm2 start processes.json --no-daemon