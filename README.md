# Demo311 -  no more data entry 
WebApp has New layers  (AI layer + photo classification)   
automated, new layers replace data entry   
Click on the “chooser” button, snap photo, and submit \**   
New issue is created on basis of the photo alone  
Pretrained model & AI classification model will:
- Determine location/address
- context - photo classification  
- Auto-Selection of “type” based on AI analysis of photo
- No need to tell the app (its graffiti, its garbage, … )

[Watch video](https://youtu.be/EcNZ0R48QLE?t=108) -   prototype app built on a few lines of html featuring API  layer that:
- Uploads photo to AWS
- API analysis of photo 
- Automatic organization of data
- Automatic creation of new issue
- Database update
- Maps / Issues integration  
\** Note - due to ios17 restrictions, 2 steps are needed in order to preserve metadata or GPS info in the photo as it uploads:
  IOS17 only [details on iphone](https://bugs.webkit.org/show_bug.cgi?id=207088#c26)  
       step 1 open camera app and take the photo that will be used in #2  
       step 2 using the chooser, select photoroll  
       then select the photo just taken, click "done" to upload that photo 
# demo311 Upload Image to the Cloud
It could not be any easier.  
From the phone's images ( gallery or snapped photos ) it does not require a native app ( ios or android ) in order to extract the following:
- what is the photo about graffiti , garbage , encampment ...
- what are the gps coordinates
- what is the street address  

Lightweight webapps use minimal html plus api layer to point, shoot, and submit - AI and a couple cloud, API calls  automatically handle the rest. 	
 [Roboflow AI](https://roboflow.com/models/classification) classifies photos by type in an app context uploading media containing all the metadata needed to define org311 issues like graffiti or garbage. Organized for easy **learn to code** experience using an interactive notebook format, this project also presents  a lightweight webapp front end, simple html providing photo uploads, parsing metadata out of the photo and classifying photos according to issue-type. When combined, these prototype features allow point-and-shoot pothole reporting - a complete capture of a org311 type issue takes place while reporting the issue is as simple as take a picture and submit it.  
## jupyter notebooks on Colab  
Notebooks provide mix of docs and special code-execution **cells**, allowing great access for total beginners to coding, python, and AI. Links below to a cloud feature called [colab](https://www.androidpolice.com/google-colab-explainer), a dashboard for running notebooks ( also see video clips helping understand how the notebooks work).    
[intro to media uploads](https://colab.research.google.com/github/rowntreerob/demo311/blob/master/photoUpld.ipynb) run this notebook, observing functions to get Address from metadata and to classify the photo with AI   
[how to use ](https://www.loom.com/share/7931a0a6a22041d889f41ffe8899e42c) the notebook above on Colab  
[python methods](https://colab.research.google.com/github/rowntreerob/demo311/blob/master/photUp_V2.ipynb) and more detail on functions from the intro demo  
[connect your DB](https://www.loom.com/share/bcdec71bf2a94cceba1ae2fc67be0606) from Mongo DB Atlas, store issues that you create in notebook sample 2 
