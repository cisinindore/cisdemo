import React, { Component } from 'react';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import Popup from 'reactjs-popup';
import { Col } from 'react-bootstrap';
import { Bert } from 'meteor/themeteorchef:bert';
import AwatarReturn from '../../components/AwsImageDisplay';
import BackgroundReturn from '../../components/AwsCharityCoverImage';
import ViewVolunteer from './viewVolunteerProfile';
import Style from '../UserDashboardProjects/style';
import StyledTab from '../BrowseProject/style';
import Tabstyle from '../Tabs/style';
import './style.css';
import { CodeStarNotifications } from 'aws-sdk';

class ApplicantsWindow extends Component {
  constructor() {
    super();
    this.state = {
      open: false,
      lappArray: [],
      openUserProfile: false,
      acceptApproved: false,
    };
    this.applyCntr = 0;
  }
  // react lifecycle method
  componentDidMount() {
    Meteor.call('getAllApplicants', this.props.projectData._id, (error, response) => {
      if (!error) {
        this.setState({
          allApplicants: response,
        });
      }
    });
  }

  // accept a volunteer code functionality is here
  acceptVolunteer = () => {
    if (this.state.popupData) {
      Meteor.call('assignProject', this.state.popupData, (error) => {
        if (!error) {
          Meteor.call('getAllApplicants', this.props.projectData._id, (err, response) => {
            if (!err) {
              this.setState({
                allApplicants: response,
              });
            }
          });
          this.setState({ open: false });
          Bert.alert('Project assigned successfully', 'success');
          this.props.getBackToPage();
        }
      });
    }
  };

  // open popup when charity select to accept a volunteer
  openPopup = (volunteerId, ProjectId, firstName, task, allapplicantData) => {
    const data = {};
    data.volunteerId = volunteerId;
    data.projectId = ProjectId;
    data.firstName = firstName;
    data.task = task;
    data.allapplicantData = allapplicantData;

    this.setState({ open: true, popupData: data });
    this.applyCntr = 0;
  };

  // function to decline volunteer user
  declineVolunteer = () => {
    if (this.state.popupData) {
      Meteor.call('rejectProjectRequest', this.state.popupData, (error) => {
        if (!error) {
          Meteor.call('getAllApplicants', this.props.projectData._id, (err, response) => {
            if (!err) {
              this.setState({
                allApplicants: response,
              });
            }
          });
          this.setState({ open: false });
          Bert.alert('Request rejected successfully', 'success');
        }
      });
    }
  };

  // close popup for acceot volunteer profile
  closeModal = () => {
    this.setState({ open: false, acceptApproved: false });
    if (this.state[this.state.popupData.projectId] !== undefined) {
      this.setState({
        [this.state.popupData.projectId]: [],
      });
    }
  };

  // close view profile popup
  closeModalViewProfile = () => {
    this.setState({ openUserProfile: false });
  };

  // close accept volunteer profile
  closeacceptPop = () => {
    this.setState({ open: false });
    if (this.state[this.state.popupData.projectId] !== undefined) {
      this.setState({
        [this.state.popupData.projectId]: [],
      });
    }
  };

  // accept volunteer selct picker change events
  handleSlectPicker = (e, userId, applicantCounter) => {
    let oldData = [];

    if (this.state.popupData.projectId !== undefined) {
      if (this.state[this.state.popupData.projectId] !== undefined) {
        oldData = this.state[this.state.popupData.projectId];
      }
    }

    const obj = {};
    obj.userId = userId;
    obj.reason = e.target.value;

    oldData[userId] = obj;

    const applicantCounters = `${this.state.popupData.projectId}_Counter`;

    this.setState({
      [this.state.popupData.projectId]: oldData,
      [applicantCounters]: applicantCounter,
    });

    if (Object.keys(oldData).length === applicantCounter - 1) {
      this.setState({ acceptApproved: true });
    }
  };

  // handle the accept volunteer popup form data
  handleAcceptForm = (event) => {
    event.preventDefault();
    Bert.defaults = {
      hideDelay: 3500,
      style: 'fixed-top',
    };

    if (this.state[this.state.popupData.projectId] !== undefined) {
      const data = this.state[this.state.popupData.projectId];
      const applicantAddedCount = Object.keys(data).length;

      const applicantCounters = `${this.state.popupData.projectId}_Counter`;
      if (applicantAddedCount !== this.state[applicantCounters] - 1) {
        Bert.alert('All the other participant should given a reason to decline', 'danger');
      } else {
        const retUsers = Object.keys(data).map((values) => data[values]);

        const obj = {};
        obj.projectId = this.state.popupData.projectId;
        obj.usersData = retUsers;
        obj.acceptedUserId = this.state.popupData.volunteerId;

        Meteor.call('applicantAcceptReject', obj, (err, res) => {
          if (!err) {
            this.closeacceptPop();
            this.props.getBackToPage();
          }
        });

        Bert.alert(
          'Successfull, once volunteer active project we will move the card to active',
          'success',
        );
      }
    } else {
      if (this.state.popupData.allapplicantData.length === 1) {
        let obj = {};
        obj.projectId = this.props.projectData._id;
        obj.usersData = [];
        obj.acceptedUserId = this.state.popupData.volunteerId;

        Meteor.call('applicantAcceptReject', obj, (err) => {
          if (!err) {
            this.closeacceptPop();
            this.props.getBackToPage();
          }
          Bert.alert(
            'Successful, once volunteer activate the project we will move the card to active',
            'success',
          );
        });
      } else {
        Bert.alert('All the other participant should given a reason to decline', 'danger');
      }
    }
  };

  /**
   * set state value to open the view profile popup
   */
  viewApplicant = (userId) => {
    this.setState({ openUserProfile: true, viewProfileUser: userId });
  };

  render() {
    const {
      getBackToPage,
      projectData,
      thiOrgLogo,
      thisOrgCover,
      causesSend,
      skillSend,
      templateTitle,
    } = this.props;

    let dateString = '';
    let avatarImage = '';
    if (projectData !== undefined) {
      const date1 = new Date(projectData.deadline);
      dateString = ` ${date1.toLocaleDateString('en-US', {
        month: 'short',
      })} ${date1.toLocaleDateString('en-US', {
        day: 'numeric',
      })}, ${date1.toLocaleDateString('en-US', { year: 'numeric' })}`;

      if (thisOrgCover) {
        avatarImage = thisOrgCover;
      }
    }

    console.log({ applicantsWindow: this.state });

    return (
      <Style.innerWapper>
        <Col xs={12} md={4} className="rightBordered">
          <input
            type="button"
            value="&#60; Back to Projects"
            onClick={() => getBackToPage()}
            className="backbtn"
          />
          <br />
          <br />
          <br />

          {/* <h2 className="topProjectTitle">{projectData.title}</h2> */}

          <Tabstyle.col100_new className="col50">
            <div className="projectBox_new">
              <StyledTab.projectBanner>
                <StyledTab.BannerOverlay className="BannerOverlay">
                  {avatarImage !== undefined ? <BackgroundReturn imagePath={avatarImage} /> : ''}
                </StyledTab.BannerOverlay>

                <StyledTab.BannerCaption>
                  <div className="rightSectionOrgLogo">
                    {thiOrgLogo !== undefined && thiOrgLogo ? (
                      thiOrgLogo !== undefined ? (
                        <AwatarReturn avatarImage={thiOrgLogo} />
                      ) : (
                          ''
                        )
                    ) : (
                        'NA'
                      )}
                  </div>

                  <div className="rightSectionProjectTitle">
                    <h2 className="topProjectTitle">{projectData.title}</h2>

                    <StyledTab.projectlabelbox className="projectlabelbox">
                      {causesSend !== undefined && causesSend !== '' ? (
                        <StyledTab.projectlabel className="colorBagni">
                          {causesSend.name}
                        </StyledTab.projectlabel>
                      ) : (
                          ''
                        )}

                      {skillSend !== undefined && skillSend !== '' ? (
                        <StyledTab.projectlabel2 style={{ background: skillSend.color }}>
                          {skillSend.name}
                        </StyledTab.projectlabel2>
                      ) : (
                          ''
                        )}
                    </StyledTab.projectlabelbox>
                  </div>
                </StyledTab.BannerCaption>
              </StyledTab.projectBanner>

              <StyledTab.projectDetail className="projectDetail">
                <StyledTab.projectHeading className="bottomProjectTitle">
                  PROJECT DETAILS
                </StyledTab.projectHeading>

                <ul className="projectDetailsBottomArea">
                  <li>
                    <img src="/images/web-development.png" />
                    <p>{templateTitle !== undefined && templateTitle ? templateTitle : 'NA'}</p>
                  </li>

                  <li>
                    <img src="/images/time_tracking.png" />
                    <p>
                      {projectData.hours} hours over {projectData.days} days
                    </p>
                  </li>

                  <li>
                    <img src="/images/deadline.png" />
                    <p>
                      Deadline:
                      {dateString}
                    </p>
                  </li>
                </ul>
              </StyledTab.projectDetail>

              <StyledTab.projectDetail className="projectDetail projectImpact_accept">
                <StyledTab.projectHeading className="projectImpact_head">
                  Project Impact
                </StyledTab.projectHeading>
                <p>{projectData.impactStatement}</p>
              </StyledTab.projectDetail>

              <StyledTab.projectDetail className="projectDetail projectInfo_accept">
                <StyledTab.projectHeading className="projectInfo_head">
                  PROJECT INFO
                </StyledTab.projectHeading>
                <div className="imgNdHead">
                  <div className="img">
                    <img src="/images/key_deliverables.png" />{' '}
                  </div>
                  <div className="text">
                    {' '}
                    <p>Key Deliverables</p>
                  </div>
                </div>
                <br />

                <ul>
                  {projectData.keyDeliverables.length > 0  ?
                    projectData.keyDeliverables.map((key) => {
                    return <li>{key}</li>;
                  }):projectData.keyDeliverables ? projectData.keyDeliverables :""}
                </ul>

                {/* <ul>
                  <li>Sit amet culpa laboris reprehenderit elit sunt.</li>
                  <li>Ullamco duis fugiat fugiat dolore commodo sint minim.</li>
                  <li>Est sunt labore ea sint</li>
                </ul> */}
                <br />

                <div className="imgNdHead">
                  <div className="img">
                    <img src="/images/benefits_to_you.png" />
                  </div>
                  <div className="text">
                    {' '}
                    <p>Benefit To You</p>
                  </div>
                </div>
                <br />
                <ul>
                  {projectData.benefits !== undefined &&
                    projectData.benefits.length > 0 &&
                    projectData.benefits.map((benefits) => {
                      return <li>{benefits}</li>;
                    })}
                </ul>
              </StyledTab.projectDetail>
            </div>
          </Tabstyle.col100_new>
        </Col>

        <Col xs={12} md={8}>
          <h2 className="topApplicantTitle">{this.state.allApplicants && this.state.allApplicants.length > 0 ? "Current Applicants":"No applicants found. Stay tuned!" } </h2>

          {this.state.allApplicants &&
            this.state.allApplicants.map((applicantData, index) => {
              let imgpath = '';
              let firstName = '';
              let volId = '';
              let volFullName = '';

              if (applicantData.history.status === 'applied') {
                if (applicantData.profile !== undefined) {
                  applicantData.profile.map((profileData) => {
                    volId = profileData._id;

                    if (profileData.profile.avatar !== undefined && profileData.profile.avatar) {
                      imgpath = profileData.profile.avatar;
                    }

                    if (
                      profileData.profile.firstName !== undefined &&
                      profileData.profile.firstName
                    ) {
                      firstName = <p className="applicantTitle">{profileData.profile.firstName}</p>;
                    }

                    if (
                      profileData.profile.firstName !== undefined &&
                      profileData.profile.firstName
                    ) {
                      volFullName = profileData.profile.firstName;
                    }
                    return true;
                  });
                }

                let createdDate = '';

                if (
                  applicantData.history.createdAt !== undefined &&
                  applicantData.history.createdAt !== ''
                ) {
                  const date1 = new Date(applicantData.history.createdAt);

                  createdDate = `${date1.toLocaleDateString('en-US', {
                    day: 'numeric',
                  })} ${date1.toLocaleDateString('en-US', {
                    month: 'short',
                  })} ${date1.toLocaleDateString('en-US', { year: 'numeric' })}`;
                }

                return (
                  <Col xs={12} md={4} key={volId + index}>
                    <div className="mainApplicantsHolder">
                      <div className="mainApplicants-image">{imgpath !== undefined ? <AwatarReturn avatarImage={imgpath} /> : ''}</div>
                      {firstName}
                      {/* <StarRatings
                        rating={feedbk.rating}
                        starDimension="40px"
                        starSpacing="15px"
                        starRatedColor="#F3DE6F"
                      /> */}

                      <p className="applicantApplied">
                        APPLIED ON:
                        <br />
                        {createdDate}
                      </p>

                      <input
                        type="button"
                        value="View Profile"
                        className="applicantBtn"
                        onClick={() => this.viewApplicant(volId)}
                      />

                      <br />
                      <input
                        type="button"
                        value="Accept"
                        className="applicantBtn"
                        onClick={() =>
                          this.openPopup(
                            volId,
                            projectData._id,
                            volFullName,
                            'accept',
                            this.state.allApplicants,
                          )
                        }
                      />
                      <br />
                      {/* <input
                        type="button"
                        value="Decline"
                        className="applicantBtn"
                        // onClick={() =>
                        // this.openPopup(volId, projectData._id, volFullName, 'reject')
                        // }
                      /> */}
                    </div>
                  </Col>
                );
              }
              return true;
            })}
        </Col>

        <Popup
          open={this.state.open}
          onClose={this.closeModal}
          style={{ /* width: '320px', */ padding: '15px' }}
          className="accept_applicantPop"
        >
          <div className="asign-project-popup">
            <form
              ref={(form) => (this.form = form)}
              onSubmit={(event) => this.handleAcceptForm(event)}
            >
              <Col xs={12} md={5} className="border-right-section">
                <p className="accept_applicant_head">accept applicant?</p>

                {// this loop will print only that user who is selected

                  this.state.popupData !== undefined &&
                  this.state.popupData.allapplicantData !== undefined &&
                  this.state.popupData.allapplicantData.map((data) => {
                    const appCntr = this.state.popupData.allapplicantData.length;
                    console.log("appCntr, ", appCntr);
                    let res = '';
                    data.profile.map((innerData) => {
                      if (innerData._id === this.state.popupData.volunteerId) {
                        let Imgpath = '';
                        let firstName = '';

                        // check for users image in database
                        if (innerData.profile.avatar !== undefined && innerData.profile.avatar) {
                          Imgpath = innerData.profile.avatar;
                        }

                        // check users name in database first
                        if (
                          innerData.profile.firstName !== undefined &&
                          innerData.profile.firstName
                        ) {
                          firstName = (
                            <p className="popApplicantTitle">{innerData.profile.firstName}</p>
                          );
                        }

                        res = (
                          <div className="acceptApplicantLeftSection viewVolunteerProfile">
                            {Imgpath !== undefined ? <AwatarReturn avatarImage={Imgpath} /> : ''}
                            {firstName}

                            <p className="remiderPopUp">
                              <span>Reminder:</span> To choose this applicant, you must select the
                              reasons for declining the other applicants.
                            </p>
                            <input type="submit" value="CONFIRM" className={this.state.acceptApproved === true || appCntr === 1 ? "conformRequest approvedAcceptVolunteer" : "conformRequest"} />
                          </div>
                        );
                      }
                    });

                    return res;
                  })}
              </Col>

              <Col xs={12} md={7}>
                <p className="closeAcceptPop">
                  <img src="/images/clearlist.png" onClick={() => this.closeacceptPop()} />
                </p>
                <p className="unSuccessMsg">FEEDBACK FOR UNSUCCESSFUL APPLICANTS</p>
                <p className="noticeTocharity">
                  Please select the reasons below for declining the other applicants. The feedback
                  you give here will help improve volunteer skill quality for future projects.
                  Applicants will recieve the reason they were declined. All applicants must have a
                  reason selected for you to confirm the succesful applicant.
                </p>

                {// this loop will print only that user who is selected

                  this.state.popupData !== undefined &&
                  this.state.popupData.allapplicantData !== undefined &&
                  this.state.popupData.allapplicantData.map((data, index) => {
                    var applicantCounter = this.state.popupData.allapplicantData.length;
                    let res = '';

                    data.profile.map((innerData) => {
                      if (innerData._id !== this.state.popupData.volunteerId) {
                        let Imgpath = '';
                        let firstName = '';
                        this.applyCntr += 1;
                        // check for users image in database
                        if (innerData.profile.avatar !== undefined && innerData.profile.avatar) {
                          Imgpath = innerData.profile.avatar;
                        }

                        // check users name in database first
                        if (
                          innerData.profile.firstName !== undefined &&
                          innerData.profile.firstName
                        ) {
                          firstName = (
                            <p className="popApplicantTitle">{innerData.profile.firstName}</p>
                          );
                        }

                        res = (
                          <div className="acceptApplicantRightSection">
                            {Imgpath !== undefined ? <AwatarReturn avatarImage={Imgpath} /> : ''}
                            <select
                              className="reasonSelectPicker"
                              name="reasonToRejectPop"
                              onChange={(e) =>
                                this.handleSlectPicker(e, innerData._id, applicantCounter)
                              }
                            >
                              <option value="">--- </option>
                              <option value="Not enough information on application">
                                {' '}
                                Not enough information on application{' '}
                              </option>
                              <option value="Someone else had more relevant experience">
                                {' '}
                                Someone else had more relevant experience{' '}
                              </option>
                              <option value="Applicant didn’t have relevant experience">
                                {' '}
                                Applicant didn’t have relevant experience{' '}
                              </option>
                              <option value="Applicant was not responsive">
                                {' '}
                                Applicant was not responsive{' '}
                              </option>
                            </select>
                          </div>
                        );
                      }
                    });

                    return res;
                  })}

                {this.applyCntr === 0 ? <p>Only one volunteer applied for this project</p> : ''}
              </Col>
            </form>
          </div>
        </Popup>

        <Popup
          open={this.state.openUserProfile}
          onClose={this.closeModalViewProfile}
          style={{ padding: '15px' }}
          className="viewprofile_applicantPop"
        >
          <ViewVolunteer volunteerid={this.state.viewProfileUser} onClose={this.closeModalViewProfile} />
        </Popup>
      </Style.innerWapper>
    );
  }
}
ApplicantsWindow.propTypes = {
  projectData: PropTypes.object.isRequired,
  getBackToPage: PropTypes.func.isRequired,
  thiOrgLogo: PropTypes.string,
  thisProCat: PropTypes.string,
  tihsProjSubCat: PropTypes.string,
};

ApplicantsWindow.defaultProps = {
  thiOrgLogo: '',
  thisProCat: '',
  tihsProjSubCat: '',
};

export default ApplicantsWindow;
