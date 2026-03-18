# rate-my-professor-api-ts
## Overview
A lightweight API wrapper around [**__Rate My Professor__**](____https://www.ratemyprofessors.com/____). Complex API calls and graphql queries have been abstracted away and simplified into the list of following features (with examples provided below):
- ****Retrieve College Summary**** : Get information related to a particular college. Such as the list of departments, loction of the college, condition of the campus, safety and satisfaction level and more.

- **Retrieve Summary About a Particular Professor** : Retrieves information about the professor, information such as the number of ratings that the professor has recieved, the department from which the particular professor is from, original link to the Rate My Professor Website.
    - In addition, information such as average rating, average difficulty, and percentage of student likely to retake this particular professor.

- **Retrieve List of Professors** : If an user wants to obtain information about the number of professors currently recorded within Rate My Professor, there's a method that can retrieve the list of all the professors for a particular college.
    - **NOTE** : New professors may not always be recorded within Rate My Professor, esepcially if they happen to be graduate students or their first semester teaching, this information can always be verified on the actual college website.

- **Retrieve Comments** : Users can retrieve list of all the comments that students has made for a particular professor wtihin a particular college.

**IMPORTANT** : Please use typescript instead of javascript and download the dev dependencies specified below, otherwise, you may run into errors.

### Stable versions
Below are the list of stable versions:
- 1.0.2
- 1.0.3
- 1.0.4
- 1.0.5

### Setup Instructions

####  Install the main dependency
```sh
npm i rate-my-professor-api-ts
```

#### Install the dev dependencies
```sh
npm install --save-dev typescript @types/node
```

#### Update the scripts for running the functions:

Within `package.json` add the following command within the `"scripts"`:
```json
{
    "scripts" : {
        "dev" : "npx tsx index.ts"
    }
}
```

### Generate tsconfig.json
- Run either of the following command on the terminal
```
npx tsc --init
```
or
```
tsc --init
```

#### File Creation
- Within the root of the project, create a new file named `index.ts` and then test out the example code provided below.

An example package.json would be:
```json
{
  "name": "ts-tests",
  "version": "1.0.0",
  "main": "index.ts",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "dev": "npx tsx index.ts"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "dependencies": {
    "rate-my-professor-api-ts": "^1.0.3"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "typescript": "^5.7.3"
  }
}
```

### Examples
**NOTE**: The primary class is `RateMyProfessor` class and can be imported as:

```typescript
import { RateMyProfessor } from "rate-my-professor-api-ts";
```

#### Calling on the constructor method
- Highly recommended to call on the constructors and it's corresponding methods within an asynchronous function.

**Constructor 1**:
```typescript
// accepts only 1 parameter
// which is the name of the college of interest
(async function main() {
   const rmp_instance = new RateMyProfessor("City College of New York");

   // one asynchronous method helps retrieve information reagrding college

   // method takes in a boolean
   // if boolean is set to true, similar matching named college info will be returned
   // if boolean is set to false, only, the specific college will be returned
   //
   let college_info = await rmp_instance.get_college_info(false);
   let college_info_all = await rmp_instance.get_college_info(true);

   // uncomment the lines below to see the response
//    console.log(college_info);
//    console.log(college_info_all);
})();
```

********


**Additional Methods using constructor 1**
```typescript
(async function main() {
   const rmp_instance = new RateMyProfessor("City College of New York");

   // another asynchronous method helps retrieve list of professors
   //
   // for the current university that the constructor has been set to
   //
   let list_of_professors = await rmp_instance.get_professor_list();
   console.log(list_of_professors);

   // method that saves result within a json file
   // and also returns the data
   //
   // data is saved to file named professor_list.json
   let list_of_professors_saved = await rmp_instance.get_professor_list_and_save("professor_list.json");

})();
```
********

**Using the setter logic to update values**
- If you need to modify the current college or professor or if the professor value hasn't been initialized, 3 seperate methods exist for ease of use.
- They are all synchronous methods.

```typescript
(async function main() {
   const rmp_instance = new RateMyProfessor("City College of New York");

   // setter method to update college
   // setter method 1
   rmp_instance.set_college("Baruch College");
   console.log(rmp_instance);

   // setter method to update professor
   // even if originally professor was null
   // setter method 2
   rmp_instance.set_professor_name("Kutub Thankur");
   console.log(rmp_instance);

   // the college and professor name
   // can also be set simultaneously
   // setter method 3
   rmp_instance.set_college_and_professor_name("Baruch College", "Kutub Thakur");
   console.log(rmp_instance);
})();
```
********

**Constructor 2**
- Whether using constructor 1 or constructor is a method of preference and depends on your own use cases.
- Below code examples shows how constructor 2 can be utilized and what are some additional methods that are available in regards to a particular professor.
```typescript
(async function main() {
   const rmp_instance = new RateMyProfessor("City College of New York", "Douglas Troeger");

   // this method will retrieve all the ratings for the current professor
   //
   // in this case, the ratings for Douglas Troeger
   // from CUNY City College
   //
   const professor_ratings = await rmp_instance.get_comments_by_professor();

   // all the get methods have a saving logic built in
   // similar to before, if you not only want the data returned
   //
   // but saved as well, the following method can be used instead
   // this will save the ratings within professor_rating.json file
   // within the current working directory
   //
   const professor_ratings_saved =
    await rmp_instance.get_comments_by_professor_and_save(
      "professor_ratings.json"
    );
   console.log(professor_ratings_saved);
})();
```

********

**Method to retrieve information about a particular professor**
- This method will retrieve information such as their average difficulty, ratings, number of ratings, department and average percentage willing to retake the professor.
- This method does not return the ratings, to retrieve all the ratings for a particular professor, use `get_comments_by_professor()` instead.

```typescript
(async function main() {
  // instantiate a new professor
  let rmp_instance = new RateMyProfessor(
    "City College of New York",
    "Douglas Troeger"
  );

  // retrieve information about professor
  // without their ratings
  // method 1
  console.log(await rmp_instance.get_professor_info());

  // save and return the professor's information
  console.log(
    await rmp_instance.get_professor_info_and_save("professor_info.json")
  );
})();
```

********

**Sample Output**
- Below is an example of what the college info looks like.
- If boolean value within `get_college_info()` is set to `true`.
- Will return information not only on the main colleges, but also similar naming colleges.

```json
{
  "school_node": [
    {
      "avg_rating_rounded": null,
      "city": "New York",
      "id": "U2Nob29sLTIyNA==",
      "legacy_id": 224,
      "name": "City College of New York",
      "num_ratings": 455,
      "state": "NY",
      "summary": {
        "campusCondition": 3.2418,
        "campusLocation": 3.222,
        "careerOpportunities": 3.2945,
        "clubAndEventActivities": 3.1429,
        "foodQuality": 2.5978,
        "internetSpeed": 3.0044,
        "libraryCondition": 3.3868,
        "schoolReputation": 3.5011,
        "schoolSafety": 3.1298,
        "schoolSatisfaction": 3.3011,
        "socialActivities": 2.9451
      }
    },
    {
      "avg_rating_rounded": null,
      "city": "New York",
      "id": "U2Nob29sLTE4ODE3",
      "legacy_id": 18817,
      "name": "CUNY City College of New York",
      "num_ratings": 4,
      "state": "NY",
      "summary": {
        "campusCondition": 2.75,
        "campusLocation": 2.5,
        "careerOpportunities": 3.25,
        "clubAndEventActivities": 4.25,
        "foodQuality": 2.5,
        "internetSpeed": 3,
        "libraryCondition": 2.75,
        "schoolReputation": 3.5,
        "schoolSafety": 2.5,
        "schoolSatisfaction": 3,
        "socialActivities": 3.25
      }
    },
    {
      "avg_rating_rounded": null,
      "city": "Brooklyn",
      "id": "U2Nob29sLTIzMA==",
      "legacy_id": 230,
      "name": "New York City College of Technology",
      "num_ratings": 418,
      "state": "NY",
      "summary": {
        "campusCondition": 2.634,
        "campusLocation": 3.4474,
        "careerOpportunities": 2.8708,
        "clubAndEventActivities": 2.6459,
        "foodQuality": 2.5455,
        "internetSpeed": 2.5813,
        "libraryCondition": 2.8923,
        "schoolReputation": 2.8134,
        "schoolSafety": 3.7563,
        "schoolSatisfaction": 2.878,
        "socialActivities": 2.5096
      }
    },
    {
      "avg_rating_rounded": null,
      "city": "Quesnel",
      "id": "U2Nob29sLTUxMTY=",
      "legacy_id": 5116,
      "name": "College of New Caledonia",
      "num_ratings": 5,
      "state": "BC",
      "summary": {
        "campusCondition": 2.4,
        "campusLocation": 2.8,
        "careerOpportunities": 2,
        "clubAndEventActivities": 1,
        "foodQuality": 1.2,
        "internetSpeed": 1.4,
        "libraryCondition": 2.4,
        "schoolReputation": 2.2,
        "schoolSafety": 4.2,
        "schoolSatisfaction": 2,
        "socialActivities": 1.6
      }
    },
    {
      "avg_rating_rounded": null,
      "city": "Mackenzie",
      "id": "U2Nob29sLTU1NTE=",
      "legacy_id": 5551,
      "name": "College of New Caledonia",
      "num_ratings": 1,
      "state": "BC",
      "summary": {
        "campusCondition": 1,
        "campusLocation": 2,
        "careerOpportunities": 1,
        "clubAndEventActivities": 1,
        "foodQuality": 1,
        "internetSpeed": 1,
        "libraryCondition": 1,
        "schoolReputation": 1,
        "schoolSafety": 0,
        "schoolSatisfaction": 1,
        "socialActivities": 1
      }
    },
    {
      "avg_rating_rounded": null,
      "city": "Prince George",
      "id": "U2Nob29sLTM5Njc=",
      "legacy_id": 3967,
      "name": "College of New Caledonia",
      "num_ratings": 51,
      "state": "BC",
      "summary": {
        "campusCondition": 2.6471,
        "campusLocation": 3.1569,
        "careerOpportunities": 2.6078,
        "clubAndEventActivities": 2.0196,
        "foodQuality": 3,
        "internetSpeed": 2.6471,
        "libraryCondition": 2.7255,
        "schoolReputation": 2.7255,
        "schoolSafety": 3.7647,
        "schoolSatisfaction": 2.9608,
        "socialActivities": 2.2745
      }
    },
    {
      "avg_rating_rounded": null,
      "city": "",
      "id": "U2Nob29sLTI1Nw==",
      "legacy_id": 257,
      "name": "College of New Rochelle",
      "num_ratings": 23,
      "state": "",
      "summary": {
        "campusCondition": 3.2174,
        "campusLocation": 3.1739,
        "careerOpportunities": 3,
        "clubAndEventActivities": 2.5652,
        "foodQuality": 2.7391,
        "internetSpeed": 3.0435,
        "libraryCondition": 3.4348,
        "schoolReputation": 2.8696,
        "schoolSafety": 2.5556,
        "schoolSatisfaction": 2.8696,
        "socialActivities": 2.3043
      }
    },
    {
      "avg_rating_rounded": null,
      "city": "New York",
      "id": "U2Nob29sLTU1ODU=",
      "legacy_id": 5585,
      "name": "Metropolitan College of New York",
      "num_ratings": 15,
      "state": "NY",
      "summary": {
        "campusCondition": 3,
        "campusLocation": 4,
        "careerOpportunities": 3.2,
        "clubAndEventActivities": 1.6667,
        "foodQuality": 1.8,
        "internetSpeed": 3.4667,
        "libraryCondition": 3.3333,
        "schoolReputation": 3.0667,
        "schoolSafety": 4.125,
        "schoolSatisfaction": 3.3333,
        "socialActivities": 2.2
      }
    }
  ]
}
```

### Getting Help
- If the examples above doesn't help and you happen to be stuck on something that's causing some intended behavior to break, below are my contact informations.

**Gmail**: dasa60196@gmail.com

**Discord** : the1sand0s (Just send a friend request and message me)
### License
This project is licensed under the MIT License.