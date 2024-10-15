import express from "express"
import bodyParser from "body-parser"
import axios from "axios"
import multer from "multer"
import { readFile, writeFile } from "fs/promises"

const app = express();
const port = 3000;
const upload = multer({ dest: "public/images/profilePics/uploads" });

const API_ID = "da126c48";
const API_KEY = "ba0464f81f3283c91b6cda6ca85ee1e7";
const API_URL = "https://api.adzuna.com/v1/api";
const JOB_PER_PAGE = 20;

/* LOAD DATA */
// let userList = [
//     { id: 0, username: "test0", password: "pass0", profile: { name: "Name 1", pic: `images/profilePics/user0.png`, bio: `Hello, my name is User0. I have a lot of experience! Thank you.`, location: "The U.S.", graduation: "Troy University" }, interests: [] },
//     { id: 1, username: "test1", password: "pass1", profile: { name: "Name 2", pic: `images/profilePics/user1.png`, bio: `Hello, my name is User1. I have a lot of experience! Thank you.`, location: "The U.S.", graduation: "Harvard University" }, interests: [] },
//     { id: 2, username: "test2", password: "pass2", profile: { name: "Name 3", pic: `images/profilePics/user2.png`, bio: `Hello, my name is User2. I have a lot of experience! Thank you.`, location: "The U.K.", graduation: "Oxford University" }, interests: [] },
// ];
// saveData(userList);

let user;
let loggedInUserID = null;  // Store the logged in user's ID
let temporaryList = [];     // Store search results page for job access



app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

/*========================== HOME PAGE ==========================*/

app.get("/", (req, res) => {
    res.render("index.ejs");
})

// Handling user inputted search data
app.post("/search", async (req, res) => {
    const jobArea = req.body.area;
    const jobTitle = req.body.title.split(" ");
    const jobLocation = req.body.location.split(" ");

    try {
        const result = await axios.get(API_URL + `/jobs/${jobArea}/search/1?app_id=${API_ID}&app_key=${API_KEY}&results_per_page=${JOB_PER_PAGE}&what=${jobTitle.join("%20")}&where=${jobLocation.join("%20")}`);

        temporaryList = result.data.results;    // Set temporary job list

        res.render("results.ejs", {     // Print results (10 per page)
            jobList: result.data.results, 
            jobCount: result.data.count, 
            jobPerPage: JOB_PER_PAGE, 
            searchInput: { area: jobArea, title: jobTitle, location: jobLocation }, 
            searchQuery: { pageIndex: 1, index: 0 }
        });
    } catch (error)  {
        console.error("Failed to make request:", error.message);
        res.status(500);
    }
})

// Search results Page with specific query parameters
app.get("/search", async (req, res) => {
    if (Object.keys(req.query).length === 0) {  // Check if there're query params
        console.error("Failed to make request: No search input.");
        res.redirect("/");
    } else {
        const jobArea = req.query.area;
        const jobTitle = req.query.title.split("%");
        const jobLocation = req.query.location.split("%");
        const pageNumber = req.query.page;
        const selectedIndex = req.query.item;
        try {
            const result = await axios.get(API_URL + `/jobs/${jobArea}/search/${pageNumber}?app_id=${API_ID}&app_key=${API_KEY}&results_per_page=${JOB_PER_PAGE}&what=${jobTitle.join("%20")}&where=${jobLocation.join("%20")}`);

            temporaryList = result.data.results;    // Set temporary job list
    
            res.render("results.ejs", {     // Print results (10 per page)
                jobList: result.data.results, 
                jobCount: result.data.count, 
                jobPerPage: JOB_PER_PAGE, 
                searchInput: { area: jobArea, title: jobTitle, location: jobLocation },
                searchQuery: { pageIndex: pageNumber, index: selectedIndex }
            });
        } catch (error) {
            console.error("Failed to make request:", error.message);
            res.status(500);
        }
    }

})



/*========================== ACCOUNT INTERACTIONS ==========================*/

/* SIGN UP */
app.get("/signup", (req, res) => {
    res.render("signup.ejs");
})

app.post("/signup", async (req, res) => {
    if (req.body.username === "" || req.body.password === "") {
        res.render("signup.ejs", { message: "Cannot leave username or password empty. Type again."})
    }

    let matched = false;
    (JSON.parse(await readFile("data.json", "utf8"))).forEach(user => {
        if (req.body.username === user.username) {  // Check if username already exists
            matched = true;
        }
    })

    if (matched) {
        res.render("signup.ejs", { message: "Username already exists. Type again." });
    } else {
        // Add new user
        saveData({ 
            username: req.body.username,
            password: req.body.password,
            profile: { name: "User", pic: "images/profilePics/pfp.jpg", location: "Not given.", graduation: "Not given"},
            interests: [] 
        });   

        res.redirect("/login"); // Go back to login page
    }
})


/* SIGN IN */
app.get("/login" , (req, res) => {
    res.render("login.ejs");
})

app.post("/login", async (req, res) => {
    try {   // Load user data
        let found = false;
        (JSON.parse(await readFile("data.json", "utf8"))).forEach(u => {
            if (u.username === req.body.username && u.password === req.body.password) {
                found = true;
                user = u;
            }
        })
    } catch (err) {
        console.error(err);
    }

    if (!user) {
        // Wrong login info
        console.log("Wrong login info. Direct back to Login page.");
        res.render("login.ejs", { loginData: false });
    } else {
        console.log("Logged in successfully. Redirect to Home.");
        res.redirect("/profile");
    }
})

app.get("/logout", (req, res) => {
    user = null;
    res.redirect("/");
})



/*========================== PROFILE ==========================*/

/* VIEW PROFILE */
app.get("/profile", (req, res) => {
    if (!user) {  // NOT logged in
        console.log("Not logged in. Redirect to Login page.");
        res.redirect("/login");
    } else {
        temporaryList = user.interests;

        if (Object.keys(req.query).length === 0) {
            res.render("profile.ejs", { user: user });
        } else {
            res.render("profile.ejs", { user: user, selectedJobID: req.query.item });
        }
    }
})

/* UPDATE PROFILE */
app.get("/edit-profile", (req, res) => {
    if (!user) {  // NOT logged in
        console.log("Not logged in. Redirect to Login page.");
        res.redirect("/login");
    } else {
        return res.render("edit-profile.ejs", { user: user });
    }
})

app.post("/edit-profile", upload.single("profile-pic"), (req, res) => {
    if (!user) {  // NOT logged in
        console.log("Not logged in. Redirect to Login page.");
        res.redirect("/login");
    } else {
        if (req.file) { user.profile.pic = `images/profilePics/uploads/${req.file.filename}`; }
        Object.keys(req.body).forEach((key) => {
            if (req.body[key].length === 0) {
                return res.render("edit-profile.ejs", { user: user, message: "Cannot leave any information empty!" });
            } else {
                user.profile[key] = req.body[key];
            }
        })

        // Update data file
        saveData(user);
        res.render("profile.ejs", { message: "Profile edited successfully!", user: user });
    }
})

/*========================== JOB ACCESS ==========================*/

/* SAVE SELECTED JOB TO INTERESTS */
app.get("/save-job", (req, res) => {
    if (!user) {  // NOT logged in
        console.log("Not logged in. Redirect to Login page.");
        res.redirect("/login");
    } else {
        const jobArea = req.query.area;
        const jobTitle = req.query.title.split("%");
        const jobLocation = req.query.location.split("%");
        const pageNumber = req.query.page;
        const selectedIndex = req.query.item;   // Job being selected and wanted to save
        
        // The url param is the index of the job being selected in the temporary list being fetched from each search page
        user.interests.push(temporaryList[selectedIndex]);
        console.log("Added to interest.")

        res.redirect(`/search?area=${jobArea}&title=${jobTitle.join("%")}&location=${jobLocation.join("%")}&page=${pageNumber}&item=${selectedIndex}`);
    }
})

/* REMOVE JOB FROM INTERESTS */
app.get("/remove-job", (req, res) => {
    if (!user) {  // NOT logged in
        console.log("Not logged in. Redirect to Login page.");
        res.redirect("/login");
    } else {
        if (req.query.index) {
            user.interests.splice(req.query.index, 1);
            console.log("Removed successfully.")
        } else {
            console.error("Index not found.");
        }

        res.redirect(`/profile`);
    }
})



app.listen(port, () => {
    console.log(`Listening on port ${port}.`);
})

/*========================== FILE HANDLING ==========================*/
async function saveData(user) {
    try {
        const users = JSON.parse(await readFile("data.json", "utf8"));
        if (users.includes(user)) {
            users[user.id] = user;
        } else {
            user.id = users.length;
            users.push(user);
        }

        try {
            await writeFile("data.json", JSON.stringify(users), "utf8");
            console.log("The data was saved!")
        } catch (err) {
            console.error(err);
        }
    } catch (err) {
        console.error(err);
    }
}