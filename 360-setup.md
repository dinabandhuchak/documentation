
# Debian WSL Development Setup Notes

## Goal

A robust local development environment within Debian WSL for Ruby on Rails projects (Ruby 3.4.3), Node.js (LTS), Git for version control, and Docker Compose for containerization.

## Prerequisites

  * **Windows Subsystem for Linux (WSL) 2** enabled.
  * **Debian** distribution installed in WSL.
  * **(Recommended)** **Docker Desktop for Windows** installed with WSL 2 integration enabled for your Debian instance.

## Setup Steps

### 1\. System Update & Essential Tools

Always start by updating your package lists and upgrading existing packages. Install fundamental tools needed for development.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install build-essential curl gnupg2 zsh git -y
```

### 2\. Oh-My-Zsh (Optional, but Highly Recommended)

Enhance your terminal experience with Zsh and Oh-My-Zsh's themes and plugins.

1.  **Set Zsh as Default Shell (if not already):**

    ```bash
    chsh -s $(which zsh) # Then close and reopen your terminal
    ```

2.  **Install Oh-My-Zsh:**

    ```bash
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
    ```

3.  **Install Common Plugins (e.g., autosuggestions, syntax-highlighting):**

    ```bash
    git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
    git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
    ```

    Then, edit your `~/.zshrc` file. Find the `plugins=(git)` line and add the desired plugins:

    ```bash
    # Example .zshrc plugins line
    plugins=(git zsh-autosuggestions zsh-syntax-highlighting npm node)
    ```

    After editing, save and `source ~/.zshrc` or open a new terminal.


### 3\. Git Configuration

Set up your global Git user name and email.

```bash
git config --global user.name "your_username"
git config --global user.email "your_email@example.com"
```

### 3\. Ruby Setup (RVM)

Install RVM to manage Ruby versions, then install the specific Ruby version for your project.

1.  **Install RVM Prerequisites:**
    (Libraries required for Ruby compilation and various gems)

    ```bash
    sudo apt install libssl-dev libreadline-dev zlib1g-dev libcurl4-openssl-dev libsqlite3-dev libyaml-dev libffi-dev libgdbm-dev libncurses5-dev automake libtool bison -y
    ```

2.  **Import RVM Keys:**

    ```bash
    gpg --keyserver hkps://keys.openpgp.org --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3 7D2BAF1CF37B13E2069D6956105BD0E739499BDB
    ```

3.  **Install RVM:**

    ```bash
    \curl -sSL https://get.rvm.io | bash -s stable
    source ~/.rvm/scripts/rvm # Or close/reopen your terminal
    ```

4.  **Install Ruby 3.4.3 & Bundler:**
    (Set Ruby 3.4.3 as your default for new terminal sessions)

    ```bash
    rvm install 3.4.3
    rvm use 3.4.3 --default
    gem install bundler
    ```

### 4\. Node.js Setup (NVM)

Use NVM to install and manage Node.js versions, which is crucial for modern Rails front-end assets.

1.  **Install NVM:**

    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
    source ~/.zshrc # Or ~/.bashrc if you're not using Zsh. Then close/reopen terminal.
    ```

2.  **Install Node.js LTS:**
    (Installs the latest Long Term Support version and sets it as default)

    ```bash
    nvm install --lts
    nvm alias default --lts
    ```
### 5\. Project Setup & Run

Finally, clone your project, install its dependencies, and run the Rails server.

1.  **Navigate to Project Directory & Clone:**

    ```bash
    cd ~/projects # Or your preferred development directory
    git clone your_project_repo_url # Replace with your project's Git URL
    cd green-lantern
    ```

2.  **Install Dependencies:**

    ```bash
    bundle install # Installs Ruby gems defined in Gemfile.lock
    npm install    # Installs Node.js packages if your project has a package.json (e.g., for Rails assets)
    ```

3.  **Docker Setup:**

    ```bash
    sudo docker compose up -d
    ```

4.  **DB setup:**

    ```bash
    bin/rails db:drop && bin/rails db:create && bin/rails db:migrate && bin/rails db:seed && bin/rails features:manage
    ```
    
5. **Start Application:**
   ```bash
   bin/rails s -p 4100
   ```

    Access your application from your Windows browser at `http://localhost:4100`. Keep the terminal window open where `rails s` is running. Press `Ctrl + C` to stop the server.
